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

// GET /api/github/file?userId=...&path=... — fetches the CURRENT content of a
// file in the user's selected repo. Used by the approval flow so a diff can be
// applied against the live repo version rather than the (possibly stale)
// snapshot the model saw when it wrote the diff.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const path = url.searchParams.get("path");

  if (!userId || !path) {
    return new Response(JSON.stringify({ error: "Missing userId or path" }), { status: 400 });
  }
  if (path.startsWith("/") || path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return new Response(JSON.stringify({ error: "Invalid repository path" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data: connection } = await supabase
    .from("github_connections")
    .select("access_token, installation_id, selected_repo")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (!connection || !connection.selected_repo) {
    return new Response(
      JSON.stringify({ error: "No GitHub repo selected or connection missing" }),
      { status: 400 }
    );
  }

  try {
    const token = (await resolveGitHubCredential(connection, "read")).token;
    const res = await fetch(
      `https://api.github.com/repos/${connection.selected_repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `GitHub API error: ${res.status}` }), { status: res.status });
    }

    const json = await res.json();
    if (!json.content || json.encoding !== "base64") {
      return new Response(JSON.stringify({ error: "Could not decode file content" }), { status: 502 });
    }

    const content = Buffer.from(json.content, "base64").toString("utf-8");
    return new Response(JSON.stringify({ content, sha: json.sha }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[github-file] Error fetching file:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch file" }), { status: 500 });
  }
}
