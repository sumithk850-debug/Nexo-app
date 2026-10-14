import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { githubApiHeaders, resolveGithubConnectionCredential } from "@/lib/githubApp.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/github/file?userId=...&path=... — fetch the current content of a
// file in the selected repository using the installed GitHub App when available.
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

  const { data: connection } = await getSupabaseAdmin()
    .from("github_connections")
    .select("access_token, selected_repo, installation_id")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (!connection?.selected_repo) {
    return new Response(JSON.stringify({ error: "No GitHub repo selected or connection missing" }), { status: 400 });
  }

  try {
    let credential = await resolveGithubConnectionCredential({
      installationId: connection.installation_id,
      encryptedOAuthToken: connection.access_token,
    });
    if (!credential) {
      return new Response(JSON.stringify({ error: "GitHub needs to be reconnected before repository files can be read." }), { status: 409 });
    }

    const fileUrl = `https://api.github.com/repos/${connection.selected_repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    let response = await fetch(fileUrl, {
      headers: githubApiHeaders(credential.token),
      cache: "no-store",
    });

    // If the App installation does not include this repository, retry the same
    // verified read with the encrypted OAuth connection for compatibility.
    if (!response.ok && credential.source === "github-app") {
      const oauthCredential = await resolveGithubConnectionCredential({ encryptedOAuthToken: connection.access_token });
      if (oauthCredential) {
        credential = oauthCredential;
        response = await fetch(fileUrl, {
          headers: githubApiHeaders(credential.token),
          cache: "no-store",
        });
      }
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `GitHub API error: ${response.status}` }), { status: response.status });
    }

    const payload = await response.json();
    if (!payload.content || payload.encoding !== "base64") {
      return new Response(JSON.stringify({ error: "Could not decode file content" }), { status: 502 });
    }

    const content = Buffer.from(String(payload.content).replace(/\s/g, ""), "base64").toString("utf-8");
    return new Response(JSON.stringify({ content, sha: payload.sha }), {
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[github-file] Error fetching file:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch file" }), { status: 500 });
  }
}
