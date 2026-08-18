import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptGithubToken } from "@/lib/githubToken.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function invalidTokenResponse() {
  return Response.json(
    { error: "GitHub could not validate that personal access token." },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const userId = body?.userId;
    const token = body?.token;
    const cleanUserId = typeof userId === "string" ? userId.trim() : "";
    const cleanToken = typeof token === "string" ? token.trim() : "";

    if (!cleanUserId || !cleanToken) {
      return Response.json({ error: "Missing user or secret." }, { status: 400 });
    }
    const verified = await requireVerifiedUser(req, cleanUserId);
    if (verified.response) return verified.response;

    // Validate the secret directly with GitHub. The raw token is never returned,
    // logged, or added to a model/chat prompt.
    const githubUserResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    if (!githubUserResponse.ok) return invalidTokenResponse();
    const githubUser = await githubUserResponse.json();
    const githubUsername = typeof githubUser?.login === "string" ? githubUser.login : null;
    if (!githubUsername) return invalidTokenResponse();

    const encryptedToken = encryptGithubToken(cleanToken);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("github_connections")
      .upsert(
        {
          user_id: verified.user.id,
          github_username: githubUsername,
          access_token: encryptedToken,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[github-pat] Failed to save encrypted secret:", error.message);
      return Response.json({ error: "Could not save the GitHub connection." }, { status: 500 });
    }

    return Response.json({ success: true, githubUsername });
  } catch (error) {
    console.error("[github-pat] Unexpected error:", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Could not connect GitHub." }, { status: 500 });
  }
}
