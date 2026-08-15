import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptIntegrationToken, decryptIntegrationToken } from "@/lib/integrationToken.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * GET  → reports whether this user has a stored Supabase connection
 *        (validates the stored token against the Management API).
 * POST → securely stores a Supabase management token for this user
 *        (no token input in the chat UI — see SupabaseConnectionCard).
 * DELETE → removes the stored connection.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ connected: false }), { status: 200 });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("supabase_connections")
    .select("supabase_username, access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.access_token) {
    return new Response(JSON.stringify({ connected: false }), { status: 200 });
  }

  // Validate the stored token is still usable.
  let username: string | null = data.supabase_username ?? null;
  let connected = false;
  try {
    const token = decryptIntegrationToken(data.access_token);
    const res = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      connected = true;
      const projects = (await res.json()) as Array<{ id: string; name?: string }> | undefined;
      if (projects?.length) username = projects[0].name ?? null;
    }
  } catch {
    connected = false;
  }

  return new Response(JSON.stringify({ connected, username }), { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = body?.userId;
  const token = body?.token?.trim();

  if (!userId || !token) {
    return new Response(JSON.stringify({ error: "Missing userId or token" }), { status: 400 });
  }

  // Validate before storing: a 200 on /v1/projects proves the token works.
  let username: string | null = null;
  try {
    const res = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "This token was rejected by the Supabase Management API." }),
        { status: 401 }
      );
    }
    const projects = (await res.json()) as Array<{ id: string; name?: string }> | undefined;
    username = projects?.[0]?.name ?? null;
  } catch {
    return new Response(JSON.stringify({ error: "Could not verify this token." }), { status: 502 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("supabase_connections")
    .upsert(
      {
        user_id: userId,
        supabase_username: username,
        access_token: encryptIntegrationToken(token),
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[supabase-status] Failed to store connection:", error.message);
    return new Response(JSON.stringify({ error: "Could not store the connection." }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, username }), { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  await supabase.from("supabase_connections").delete().eq("user_id", userId);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
