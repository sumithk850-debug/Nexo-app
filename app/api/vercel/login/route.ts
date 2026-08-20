import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauthState.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { createVercelPkce, vercelPkceCookieOptions, VERCEL_PKCE_COOKIE } from "@/lib/vercelOAuth.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;
  const clientId = process.env.VERCEL_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Vercel OAuth is not configured." }), {
      status: 500,
    });
  }

  const redirectUri = `${req.nextUrl.origin}/api/vercel/callback`;
  const { codeVerifier, codeChallenge } = createVercelPkce();
  const authUrl = new URL("https://vercel.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", createOAuthState(verified.user.id, "vercel"));
  // Vercel filters out scopes that are not enabled on the app's Permissions
  // page; explicitly request the standard set so the refresh token is issued.
  authUrl.searchParams.set("scope", "openid email profile offline_access");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.json({ authorizationUrl: authUrl.toString() });
  response.cookies.set(
    VERCEL_PKCE_COOKIE,
    codeVerifier,
    vercelPkceCookieOptions(req.nextUrl.protocol === "https:")
  );
  return response;
}
