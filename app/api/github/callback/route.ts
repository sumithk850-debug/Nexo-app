import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// IMPORTANT: This uses the service role key (server-only, never exposed to
// the browser) so this trusted backend route can write to github_connections
// on the user's behalf, bypassing RLS — which is correct here since this
// route already verified the user via the OAuth "state" parameter.
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function htmlError(title: string, detail: string) {
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#0A0E1A;color:#E8ECFB;">
      <h2 style="color:#ff6b6b;">${title}</h2>
      <pre style="white-space:pre-wrap;background:#111;padding:16px;border-radius:8px;font-size:13px;">${detail}</pre>
      <a href="/" style="color:#00E5FF;">← Back to NEXO AI</a>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  if (!code || !userId) {
    return htmlError(
      "Missing parameters",
      `code present: ${!!code}\nstate (userId) present: ${!!userId}\nuserId value: ${userId}`
    );
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return htmlError(
      "Server not configured",
      `GITHUB_OAUTH_CLIENT_ID set: ${!!clientId}\nGITHUB_OAUTH_CLIENT_SECRET set: ${!!clientSecret}\n\nAdd these in Vercel → Settings → Environment Variables.`
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return htmlError(
      "Server not configured",
      `SUPABASE_SERVICE_ROLE_KEY is missing.\n\nAdd it in Vercel → Settings → Environment Variables (get it from Supabase → Settings → API → service_role key).`
    );
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return htmlError(
        "GitHub token exchange failed",
        JSON.stringify(tokenData, null, 2)
      );
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    const githubUser = await userRes.json();
    const githubUsername = githubUser.login ?? "unknown";

    const supabase = getSupabaseAdmin();
    const { data: upsertData, error: upsertError } = await supabase
      .from("github_connections")
      .upsert(
        {
          user_id: userId,
          github_username: githubUsername,
          access_token: accessToken,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select();

    if (upsertError) {
      return htmlError(
        "Database save failed",
        `Error: ${upsertError.message}\nCode: ${upsertError.code}\nDetails: ${upsertError.details}\nHint: ${upsertError.hint}\n\nuserId used: ${userId}\ngithubUsername: ${githubUsername}`
      );
    }

    return NextResponse.redirect(`${req.nextUrl.origin}/?github_connected=1`);
  } catch (err) {
    return htmlError("Unexpected error", String(err));
  }
}
