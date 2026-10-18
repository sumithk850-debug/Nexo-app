import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { githubApiHeaders, resolveGithubConnectionCredential } from "@/lib/githubApp.server";
import { resolveGithubOAuthToken } from "@/lib/githubOAuth.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/github/repos?userId=xxx — list repositories available to the
// installed GitHub App, falling back to the user's OAuth connection for older
// installations that have not been upgraded yet.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const { data: connection } = await getSupabaseAdmin()
    .from("github_connections")
    .select("access_token, selected_repo, installation_id")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (!connection) {
    return new Response(JSON.stringify({ error: "GitHub not connected" }), { status: 404 });
  }

  try {
    const credential = await resolveGithubConnectionCredential({
      installationId: connection.installation_id,
      encryptedOAuthToken: connection.access_token,
    });
    if (!credential) {
      return new Response(JSON.stringify({ error: "GitHub credentials are unavailable. Reconnect GitHub." }), { status: 401 });
    }

    const appResponse = credential.source === "github-app"
      ? await fetch("https://api.github.com/installation/repositories?per_page=100", {
          headers: githubApiHeaders(credential.token),
          cache: "no-store",
        })
      : null;
    const response = appResponse?.ok
      ? appResponse
      : await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
          headers: githubApiHeaders(credential.token),
          cache: "no-store",
        });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch repos from GitHub" }), { status: 502 });
    }

    const payload = await response.json();
    const repos = Array.isArray(payload) ? payload : payload.repositories;
    if (!Array.isArray(repos)) {
      return new Response(JSON.stringify({ error: "GitHub returned an invalid repository list" }), { status: 502 });
    }

    // Include repositories created through the user's OAuth connection even
    // when the GitHub App installation is restricted to selected repositories.
    let combinedRepos = repos;
    const oauthToken = resolveGithubOAuthToken(connection.access_token);
    if (credential.source === "github-app" && oauthToken) {
      const oauthResponse = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
        headers: githubApiHeaders(oauthToken),
        cache: "no-store",
      });
      if (oauthResponse.ok) {
        const oauthPayload = await oauthResponse.json();
        if (Array.isArray(oauthPayload)) {
          const byFullName = new Map<string, any>();
          for (const item of [...repos, ...oauthPayload]) {
            if (item && typeof item.full_name === "string") byFullName.set(item.full_name.toLowerCase(), item);
          }
          combinedRepos = Array.from(byFullName.values());
        }
      }
    }

    const simplified = combinedRepos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
    }));

    const selectedIsAvailable = simplified.some((repo: any) => repo.fullName === connection.selected_repo);
    if (connection.selected_repo && !selectedIsAvailable) {
      await getSupabaseAdmin()
        .from("github_connections")
        .update({ selected_repo: null })
        .eq("user_id", verified.user.id);
    }

    return new Response(
      JSON.stringify({
        repos: simplified,
        selectedRepo: selectedIsAvailable ? connection.selected_repo : null,
        staleSelectedRepo: selectedIsAvailable ? null : connection.selected_repo,
        credentialSource: credential.source,
      }),
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error fetching repos" }), { status: 500 });
  }
}

// POST /api/github/repos — set the selected/active repo for this user.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
  const { userId, repoFullName } = body as { userId?: string; repoFullName?: string };

  if (!userId || !repoFullName) {
    return new Response(JSON.stringify({ error: "Missing userId or repoFullName" }), { status: 400 });
  }
  if (typeof repoFullName !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repoFullName)) {
    return new Response(JSON.stringify({ error: "Invalid repository name" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data: connection, error: connectionError } = await supabase
    .from("github_connections")
    .select("access_token, installation_id")
    .eq("user_id", verified.user.id)
    .maybeSingle();
  if (connectionError || !connection) {
    return new Response(JSON.stringify({ error: "GitHub is not connected. Connect GitHub before selecting a repository." }), { status: 404 });
  }

  const credential = await resolveGithubConnectionCredential({
    installationId: connection.installation_id,
    encryptedOAuthToken: connection.access_token,
  });
  if (!credential) {
    return new Response(JSON.stringify({ error: "GitHub credentials are unavailable. Reconnect GitHub." }), { status: 401 });
  }

  let repoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, {
    headers: githubApiHeaders(credential.token),
    cache: "no-store",
  });
  if (!repoResponse.ok) {
    const oauthToken = resolveGithubOAuthToken(connection.access_token);
    if (oauthToken) {
      repoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        headers: githubApiHeaders(oauthToken),
        cache: "no-store",
      });
    }
  }
  if (!repoResponse.ok) {
    return new Response(JSON.stringify({
      error: "That repository is not available to the connected GitHub account. Check its permissions and reconnect GitHub if needed.",
      code: "REPOSITORY_NOT_AVAILABLE",
    }), { status: 403 });
  }

  const { error } = await supabase
    .from("github_connections")
    .update({ selected_repo: repoFullName })
    .eq("user_id", verified.user.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
