import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ connected: false }), { status: 200 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("vercel_connections")
    .select("vercel_username, access_token")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (!data?.access_token) {
    return new Response(JSON.stringify({ connected: false }), { status: 200 });
  }

  // Verify the stored token is still valid by hitting the userinfo endpoint.
  // An expired or revoked token simply reports the account as disconnected.
  let username: string | null = data.vercel_username ?? null;
  let connected = false;
  try {
    const { decryptIntegrationToken } = await import("@/lib/integrationToken.server");
    const token = decryptIntegrationToken(data.access_token);
    const res = await fetch("https://api.vercel.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      connected = true;
      const info = await res.json();
      if (info?.email) username = info.email;
    }
  } catch {
    connected = false;
  }

  return new Response(JSON.stringify({ connected, username }), { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;
  const supabase = getSupabaseAdmin();
  await supabase.from("vercel_connections").delete().eq("user_id", verified.user.id);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
