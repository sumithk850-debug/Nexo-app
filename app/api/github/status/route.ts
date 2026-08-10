import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ connected: false }), { status: 200 });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("github_connections")
    .select("github_username, access_token")
    .eq("user_id", userId)
    .maybeSingle();

  let canWrite = false;
  if (data?.access_token) {
    const scopesRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const scopes = scopesRes.headers.get("x-oauth-scopes") ?? "";
    canWrite = scopes.split(",").map((scope) => scope.trim()).some((scope) => scope === "repo" || scope === "public_repo");
  }

  return new Response(
    JSON.stringify({
      connected: !!data,
      githubUsername: data?.github_username ?? null,
      canWrite,
    }),
    { status: 200 }
  );
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("github_connections").delete().eq("user_id", userId);

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
