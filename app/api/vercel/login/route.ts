import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauthState.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

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
  const authUrl = new URL("https://vercel.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", createOAuthState(verified.user.id, "vercel"));
  // Vercel filters out scopes that are not enabled on the app's Permissions
  // page; explicitly request the standard set so the refresh token is issued.
  authUrl.searchParams.set("scope", "openid email profile offline_access");
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.json({ authorizationUrl: authUrl.toString() });
}
