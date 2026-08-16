import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptIntegrationToken } from "@/lib/integrationToken.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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
    return backToApp(req, { supabase: "error", reason: "missing_code" });
  }

  if (!process.env.SUPABASE_OAUTH_CLIENT_ID || !process.env.SUPABASE_OAUTH_CLIENT_SECRET) {
    console.error("[supabase-callback] OAuth app credentials are not configured");
    return backToApp(req, { supabase: "error", reason: "not_configured" });
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/supabase/callback`;
    // Exchange the authorization code for access + refresh tokens.
    const tokenRes = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SUPABASE_OAUTH_CLIENT_ID}:${process.env.SUPABASE_OAUTH_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    const refreshToken = tokenData?.refresh_token ?? null;
    if (!accessToken) {
      console.error("[supabase-callback] Token exchange failed:", tokenData?.error ?? tokenData);
      return backToApp(req, { supabase: "error", reason: "token_exchange_failed" });
    }

    // Identify the connected Supabase account (Management API /v1/organizations).
    const orgRes = await fetch("https://api.supabase.com/v1/organizations", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const orgs = orgRes.ok ? (await orgRes.json().catch(() => [])) : [];
    const username = Array.isArray(orgs) && orgs.length > 0 ? orgs[0]?.name ?? null : null;
    const userIdent = username ?? "unknown";

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase
      .from("supabase_connections")
      .upsert(
        {
          user_id: userId,
          supabase_username: username,
          access_token: encryptIntegrationToken(accessToken),
          refresh_token: refreshToken ? encryptIntegrationToken(refreshToken) : null,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[supabase-callback] Failed to store connection:", upsertError.message);
      return backToApp(req, { supabase: "error", reason: "save_failed" });
    }

    return backToApp(req, { supabase: "connected", user: userIdent });
  } catch (err) {
    console.error("[supabase-callback] Unexpected error:", err);
    return backToApp(req, { supabase: "error", reason: "unexpected" });
  }
}
