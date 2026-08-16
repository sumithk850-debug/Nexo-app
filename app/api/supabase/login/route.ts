import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Supabase OAuth is not configured." }), {
      status: 500,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/supabase/callback`;
  const authUrl = new URL("https://api.supabase.com/v1/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  // Pass the NEXO user id through as OAuth "state" so the callback knows
  // which account to attach this Supabase connection to.
  authUrl.searchParams.set("state", userId);
  // The "all" scope covers Management API access to the user's projects.
  authUrl.searchParams.set("scope", "all");

  return NextResponse.redirect(authUrl.toString());
}
