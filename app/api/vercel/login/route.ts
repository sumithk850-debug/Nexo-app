import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.VERCEL_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Vercel OAuth is not configured." }), {
      status: 500,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/vercel/callback`;
  const authUrl = new URL("https://vercel.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  // Pass the NEXO user id through as OAuth "state" so the callback knows
  // which account to attach this Vercel connection to.
  authUrl.searchParams.set("state", userId);

  return NextResponse.redirect(authUrl.toString());
}
