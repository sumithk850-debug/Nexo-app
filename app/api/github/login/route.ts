import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauthState.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "GitHub OAuth is not configured." }), {
      status: 500,
    });
  }

  const redirectUri = `${req.nextUrl.origin}/api/github/callback`;

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo read:user");
  authUrl.searchParams.set("state", createOAuthState(verified.user.id, "github"));

  return NextResponse.json({ authorizationUrl: authUrl.toString() });
}
