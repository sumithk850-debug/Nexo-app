import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Never leak environment values or provider payloads to the browser: the OAuth
// callback only reports a short, safe reason and sends the user back to the app.
function backToApp(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/", req.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  if (!code || !userId) {
    return backToApp(req, { github: "error", reason: "missing_code" });
  }

  if (!process.env.GITHUB_OAUTH_CLIENT_ID || !process.env.GITHUB_OAUTH_CLIENT_SECRET) {
    console.error("[github-callback] OAuth app credentials are not configured");
    return backToApp(req, { github: "error", reason: "not_configured" });
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("[github-callback] Token exchange failed:", tokenData?.error);
      return backToApp(req, { github: "error", reason: "token_exchange_failed" });
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    const githubUser = await userRes.json();
    const githubUsername = githubUser.login ?? "unknown";

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase
      .from("github_connections")
      .upsert(
        {
          user_id: userId,
          github_username: githubUsername,
          access_token: accessToken,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[github-callback] Failed to store connection:", upsertError.message);
      return backToApp(req, { github: "error", reason: "save_failed" });
    }

    return backToApp(req, { github: "connected", user: githubUsername });
  } catch (err) {
    console.error("[github-callback] Unexpected error:", err);
    return backToApp(req, { github: "error", reason: "unexpected" });
  }
}
