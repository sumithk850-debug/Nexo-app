import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { githubApiHeaders } from "@/lib/githubApp.server";
import { resolveGithubOAuthToken } from "@/lib/githubOAuth.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * POST /api/github/create-repo
 *
 * Creates a repository only after an authenticated user explicitly confirms
 * the action in the UI. Uses the user's server-held OAuth credential; tokens
 * are never accepted from or returned to the browser.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    userId?: string;
    name?: string;
    description?: string;
    visibility?: "private" | "public";
    confirmCreate?: boolean;
  } | null;

  if (!body || body.confirmCreate !== true) {
    return json({ error: "Explicit confirmation is required before creating a repository." }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const visibility = body.visibility;

  if (!body.userId) return json({ error: "Sign in before creating a repository." }, 400);
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name) || name === "." || name === ".." || name.toLowerCase().endsWith(".git")) {
    return json({ error: "Use a valid repository name (letters, numbers, dots, hyphens, or underscores)." }, 400);
  }
  if (description.length > 350) return json({ error: "The description must be 350 characters or fewer." }, 400);
  if (visibility !== "private" && visibility !== "public") {
    return json({ error: "Choose whether the repository should be private or public." }, 400);
  }

  const verified = await requireVerifiedUser(req, body.userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data: connection, error: connectionError } = await supabase
    .from("github_connections")
    .select("access_token, github_username")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (connectionError || !connection?.access_token || !connection.github_username) {
    return json({ error: "Connect GitHub again before creating a repository." }, 409);
  }

  const token = resolveGithubOAuthToken(connection.access_token);
  if (!token) return json({ error: "The saved GitHub authorization is unavailable. Reconnect GitHub and try again." }, 409);

  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: githubApiHeaders(token),
      cache: "no-store",
    });
    if (!userResponse.ok) {
      return json({ error: "GitHub could not verify the connected account. Reconnect GitHub and try again." }, 409);
    }
    const githubUser = await userResponse.json() as { login?: string };
    if (!githubUser.login || githubUser.login.toLowerCase() !== connection.github_username.toLowerCase()) {
      return json({ error: "The connected GitHub account changed. Reconnect GitHub before creating a repository." }, 409);
    }

    const createResponse = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: githubApiHeaders(token, true),
      cache: "no-store",
      body: JSON.stringify({
        name,
        description: description || undefined,
        private: visibility === "private",
        auto_init: true,
        has_issues: true,
        has_projects: false,
        has_wiki: false,
      }),
    });

    const result = await createResponse.json().catch(() => null) as {
      id?: number;
      name?: string;
      full_name?: string;
      html_url?: string;
      private?: boolean;
      default_branch?: string;
      message?: string;
    } | null;

    if (!createResponse.ok || !result?.full_name) {
      if (createResponse.status === 403 || createResponse.status === 401) {
        return json({
          error: "GitHub denied repository creation. Reconnect GitHub and grant the required repository-creation permission, then try again.",
          code: "GITHUB_REPOSITORY_CREATION_PERMISSION_REQUIRED",
        }, 403);
      }
      if (createResponse.status === 422) {
        return json({ error: "GitHub could not create that repository. The name may already be taken or the account may have reached a repository limit." }, 422);
      }
      return json({ error: "GitHub could not create the repository. Please try again." }, 502);
    }

    const { error: saveError } = await supabase
      .from("github_connections")
      .update({ selected_repo: result.full_name })
      .eq("user_id", verified.user.id);

    return json({
      success: true,
      repository: {
        id: result.id,
        name: result.name,
        fullName: result.full_name,
        url: result.html_url,
        private: result.private,
        defaultBranch: result.default_branch,
      },
      selected: !saveError,
      warning: saveError ? "The repository was created, but NEXO could not save it as the active repository. Refresh GitHub integration and select it manually." : null,
    }, 201);
  } catch {
    return json({ error: "An unexpected error occurred while creating the repository." }, 500);
  }
}
