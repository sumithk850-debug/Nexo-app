import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state"); // NEXO user id, passed through from /login

  if (!code || !userId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/?github_error=missing_params`);
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${req.nextUrl.origin}/?github_error=not_configured`);
  }

  try {
    // Exchange the temporary code for an access token.
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
      return NextResponse.redirect(`${req.nextUrl.origin}/?github_error=token_exchange_failed`);
    }

    // Fetch the connected GitHub user's username.
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    const githubUser = await userRes.json();
    const githubUsername = githubUser.login ?? "unknown";

    // Save (or update) the connection for this NEXO user.
    const supabase = getSupabase();
    await supabase.from("github_connections").upsert(
      {
        user_id: userId,
        github_username: githubUsername,
        access_token: accessToken,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.redirect(`${req.nextUrl.origin}/?github_connected=1`);
  } catch {
    return NextResponse.redirect(`${req.nextUrl.origin}/?github_error=unexpected`);
  }
}
