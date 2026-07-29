import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "GitHub OAuth is not configured." }), {
      status: 500,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/github/callback`;

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo read:user");
  // Pass the NEXO user id through as OAuth "state" so the callback knows
  // which account to attach this GitHub connection to.
  authUrl.searchParams.set("state", userId);

  return NextResponse.redirect(authUrl.toString());
}
