import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createInstallationAccessToken,
  githubApiHeaders,
  isGitHubAppConfigured,
} from "@/lib/githubApp.server";
import {
  checkGithubOAuthRepositoryWrite,
  resolveGithubOAuthToken,
} from "@/lib/githubOAuth.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function installationCanWrite(installationId: string, selectedRepo: string | null): Promise<boolean> {
  if (!isGitHubAppConfigured() || !selectedRepo) return false;
  try {
    const { token } = await createInstallationAccessToken(installationId);
    const response = await fetch(`https://api.github.com/repos/${selectedRepo}`, {
      headers: githubApiHeaders(token),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const repo = (await response.json()) as { permissions?: { push?: boolean } };
    return repo.permissions?.push === true;
  } catch {
    return false;
  }
}

async function oauthCanWrite(storedToken: string | null, selectedRepo: string | null): Promise<boolean> {
  if (!selectedRepo) return false;
  const token = resolveGithubOAuthToken(storedToken);
  if (!token) return false;
  return (await checkGithubOAuthRepositoryWrite(token, selectedRepo)).canWrite;
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return Response.json({ connected: false });

  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("github_connections")
    .select("github_username, selected_repo, installation_id, access_token")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  const appCanWrite = data?.installation_id
    ? await installationCanWrite(data.installation_id, data.selected_repo ?? null)
    : false;
  const canWrite = appCanWrite || Boolean(data && await oauthCanWrite(data.access_token, data.selected_repo ?? null));

  return Response.json({
    connected: Boolean(data),
    githubUsername: data?.github_username ?? null,
    canWrite,
  });
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const { error } = await getSupabaseAdmin()
    .from("github_connections")
    .delete()
    .eq("user_id", verified.user.id);
  if (error) return Response.json({ error: "GitHub could not be disconnected." }, { status: 500 });

  return Response.json({ success: true });
}
