import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGitHubWriteCapability } from "@/lib/githubApp.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

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
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("github_connections")
    .select("github_username, access_token, installation_id")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  const writeCapability = data ? await getGitHubWriteCapability(data) : { canWrite: false, source: null, configurationMissing: false };

  return new Response(
    JSON.stringify({
      connected: !!data,
      githubUsername: data?.github_username ?? null,
      canWrite: writeCapability.canWrite,
      writeSource: writeCapability.source,
      appConfigurationMissing: writeCapability.configurationMissing,
    }),
    { status: 200 }
  );
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  await supabase.from("github_connections").delete().eq("user_id", verified.user.id);

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
