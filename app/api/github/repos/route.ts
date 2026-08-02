import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const supabase = getSupabaseAdmin();
  const { data: connection } = await supabase
    .from("github_connections")
    .select("access_token, selected_repo")
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection) {
    return new Response(JSON.stringify({ error: "GitHub not connected" }), { status: 404 });
  }

  try {
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch repos from GitHub" }), { status: 502 });
    }

    const repos = await res.json();
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
  const body = await req.json();
  const { userId, repoFullName } = body;

  if (!userId || !repoFullName) {
    return new Response(JSON.stringify({ error: "Missing userId or repoFullName" }), { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("github_connections")
    .update({ selected_repo: repoFullName })
    .eq("user_id", userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
