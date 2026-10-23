import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const verified = requestedUserId ? await requireVerifiedUser(req, requestedUserId) : null;
  if (verified?.response) return verified.response;
  if (!verified?.user.id) return Response.json({ connected: false }, { status: 200 });

  const { data, error } = await admin().from("browser_connections").select("device_label, extension_id, connected_at, last_seen_at, revoked_at").eq("user_id", verified.user.id).maybeSingle();
  if (error) return Response.json({ connected: false, error: "Browser connection storage is not available yet." }, { status: 200 });
  const connected = Boolean(data && !data.revoked_at);
  return Response.json({ connected, connection: connected ? data : null });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const requestedUserId = typeof body.userId === "string" ? body.userId : null;
  const verified = requestedUserId ? await requireVerifiedUser(req, requestedUserId) : null;
  if (verified?.response) return verified.response;
  if (!verified?.user.id) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.trim().slice(0, 80) : "Local browser";
  const extensionId = typeof body.extensionId === "string" ? body.extensionId.trim().slice(0, 120) : null;
  const { data, error } = await admin().from("browser_connections").upsert({ user_id: verified.user.id, device_label: deviceLabel || "Local browser", extension_id: extensionId, connected_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), revoked_at: null }, { onConflict: "user_id" }).select("device_label, extension_id, connected_at, last_seen_at, revoked_at").single();
  if (error) return Response.json({ error: "Browser connection storage is not ready. Apply migration 018_browser_connections.sql first." }, { status: 503 });
  return Response.json({ connected: true, connection: data });
}

export async function DELETE(req: NextRequest) {
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const verified = requestedUserId ? await requireVerifiedUser(req, requestedUserId) : null;
  if (verified?.response) return verified.response;
  if (!verified?.user.id) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { error } = await admin().from("browser_connections").update({ revoked_at: new Date().toISOString(), last_seen_at: new Date().toISOString() }).eq("user_id", verified.user.id);
  if (error) return Response.json({ error: "Could not disconnect the browser." }, { status: 500 });
  return Response.json({ connected: false });
}
