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

export async function GET(req: NextRequest) {
  const auth = await requireVerifiedUser(req);
  if (auth.response) return auth.response;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("mission_jobs")
      .select(MISSION_FIELDS)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("[missions:list]", error.message);
      return jsonError("Mission history is temporarily unavailable.", 503);
    }

    return NextResponse.json({ missions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[missions:list]", error instanceof Error ? error.message : "unknown error");
    return jsonError("Mission service is not configured yet.", 503);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireVerifiedUser(req);
  if (auth.response) return auth.response;

  let body: { title?: unknown; prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Please send a valid mission request.", 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return jsonError("Describe the task you want KYVORIX to complete.", 400);
  if (prompt.length > 12000) return jsonError("Mission instructions must be 12,000 characters or fewer.", 413);

  const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";
  const title = (requestedTitle || prompt.replace(/\s+/g, " ")).slice(0, 120).trim();
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? null;
  if (idempotencyKey && !/^[a-zA-Z0-9:_-]{8,120}$/.test(idempotencyKey)) {
    return jsonError("The request identifier is invalid.", 400);
  }

  try {
    const admin = getSupabaseAdmin();

    if (idempotencyKey) {
      const { data: existing, error: lookupError } = await admin
        .from("mission_jobs")
        .select(MISSION_FIELDS)
        .eq("user_id", auth.user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (lookupError) {
        console.error("[missions:idempotency]", lookupError.message);
        return jsonError("Could not safely confirm whether this mission was already created.", 503);
      }
      if (existing) return NextResponse.json({ mission: existing }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const { data, error } = await admin
      .from("mission_jobs")
      .insert({
        user_id: auth.user.id,
        idempotency_key: idempotencyKey,
        title,
        prompt,
        status: "queued",
      })
      .select(MISSION_FIELDS)
      .single();

    if (error) {
      // A concurrent retry may win the unique idempotency key race.
      if (idempotencyKey && error.code === "23505") {
        const { data: existing } = await admin
          .from("mission_jobs")
          .select(MISSION_FIELDS)
          .eq("user_id", auth.user.id)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existing) return NextResponse.json({ mission: existing }, { status: 200, headers: { "Cache-Control": "no-store" } });
      }
      console.error("[missions:create]", error.message);
      return jsonError("KYVORIX could not queue this mission. Please try again.", 503);
    }

    return NextResponse.json({ mission: data }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[missions:create]", error instanceof Error ? error.message : "unknown error");
    return jsonError("Mission service is not configured yet.", 503);
  }
}
