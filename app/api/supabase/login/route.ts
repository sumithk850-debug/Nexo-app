import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauthState.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Supabase OAuth is not configured." }), {
      status: 500,
    });
  }

  const redirectUri = `${req.nextUrl.origin}/api/supabase/callback`;
  const authUrl = new URL("https://api.supabase.com/v1/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", createOAuthState(verified.user.id, "supabase"));
  // The "all" scope covers Management API access to the user's projects.
  authUrl.searchParams.set("scope", "all");

  return NextResponse.json({ authorizationUrl: authUrl.toString() });
}
