import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveGitHubCredential } from "@/lib/githubApp.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/github/repos?userId=xxx — list the connected user's GitHub repos
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data: connection } = await supabase
    .from("github_connections")
    .select("access_token, installation_id, selected_repo")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (!connection) {
    return new Response(JSON.stringify({ error: "GitHub not connected" }), { status: 404 });
  }

  try {
    const credential = await resolveGitHubCredential(connection, "read");
    const endpoint = credential.source === "installation"
      ? "https://api.github.com/installation/repositories?per_page=100"
      : "https://api.github.com/user/repos?sort=updated&per_page=50";
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${credential.token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch repos from GitHub" }), { status: 502 });
    }

    const payload = await res.json();
    const repos = Array.isArray(payload) ? payload : payload.repositories;
    if (!Array.isArray(repos)) {
      return new Response(JSON.stringify({ error: "GitHub returned an invalid repository list" }), { status: 502 });
    }
    const simplified = repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
    }));

    return new Response(
      JSON.stringify({ repos: simplified, selectedRepo: connection.selected_repo }),
      { status: 200 }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error fetching repos" }), { status: 500 });
  }
}

// POST /api/github/repos — set the selected/active repo for this user
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
  const { userId, repoFullName } = body;

  if (!userId || !repoFullName) {
    return new Response(JSON.stringify({ error: "Missing userId or repoFullName" }), { status: 400 });
  }
  if (typeof repoFullName !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repoFullName)) {
    return new Response(JSON.stringify({ error: "Invalid repository name" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data: connection } = await supabase
    .from("github_connections")
    .select("access_token, installation_id")
    .eq("user_id", verified.user.id)
    .maybeSingle();
  if (!connection) {
    return new Response(JSON.stringify({ error: "GitHub not connected" }), { status: 404 });
  }
  try {
    const credential = await resolveGitHubCredential(connection, "read");
    const repoCheck = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${credential.token}` },
      cache: "no-store",
    });
    if (!repoCheck.ok) {
      return new Response(JSON.stringify({ error: "This repository is not available to the connected GitHub account or App." }), { status: 403 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "GitHub repository access could not be verified." }), { status: 403 });
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
