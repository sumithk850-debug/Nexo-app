import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISSION_FIELDS =
  "id,title,prompt,status,plan,current_step,step_results,result,verification,attempt_count,last_error,cancel_requested,created_at,updated_at,started_at,completed_at";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getMissionId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireVerifiedUser(req);
  if (auth.response) return auth.response;
  const id = await getMissionId(context);
  if (!id) return jsonError("Mission not found.", 404);

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("mission_jobs")
      .select(MISSION_FIELDS)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) {
      console.error("[missions:read]", error.message);
      return jsonError("Mission details are temporarily unavailable.", 503);
    }
    if (!data) return jsonError("Mission not found.", 404);
    return NextResponse.json({ mission: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[missions:read]", error instanceof Error ? error.message : "unknown error");
    return jsonError("Mission service is not configured yet.", 503);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireVerifiedUser(req);
  if (auth.response) return auth.response;
  const id = await getMissionId(context);
  if (!id) return jsonError("Mission not found.", 404);

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid mission action.", 400);
  }
  if (body.action !== "cancel") return jsonError("Unsupported mission action.", 400);

  try {
    const admin = getSupabaseAdmin();
    const { data: mission, error: readError } = await admin
      .from("mission_jobs")
      .select("id,status,cancel_requested")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (readError) {
      console.error("[missions:cancel:read]", readError.message);
      return jsonError("Could not read this mission.", 503);
    }
    if (!mission) return jsonError("Mission not found.", 404);

    if (["completed", "failed", "cancelled"].includes(mission.status)) {
      return NextResponse.json({ status: mission.status }, { headers: { "Cache-Control": "no-store" } });
    }

    const queued = mission.status === "queued" || mission.status === "retry_wait";
    const { data, error } = await admin
      .from("mission_jobs")
      .update({
        cancel_requested: true,
        status: queued ? "cancelled" : "running",
        completed_at: queued ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .in("status", ["queued", "running", "retry_wait"])
      .select("id,status,cancel_requested")
      .maybeSingle();

    if (error) {
      console.error("[missions:cancel:update]", error.message);
      return jsonError("Could not cancel this mission right now.", 503);
    }
    if (!data) return jsonError("Mission state changed. Refresh and try again.", 409);

    return NextResponse.json({ status: data.status, cancelRequested: data.cancel_requested }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[missions:cancel]", error instanceof Error ? error.message : "unknown error");
    return jsonError("Mission service is not configured yet.", 503);
  }
}
