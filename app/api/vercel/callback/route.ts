import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptIntegrationToken } from "@/lib/integrationToken.server";
import { verifyOAuthState } from "@/lib/oauthState.server";

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
  const userId = verifyOAuthState(req.nextUrl.searchParams.get("state"), "vercel");

  if (!code || !userId) {
    return backToApp(req, { vercel: "error", reason: "invalid_state" });
  }

  if (!process.env.VERCEL_CLIENT_ID || !process.env.VERCEL_CLIENT_SECRET) {
    console.error("[vercel-callback] OAuth app credentials are not configured");
    return backToApp(req, { vercel: "error", reason: "not_configured" });
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/vercel/callback`;
    const tokenRes = await fetch("https://api.vercel.com/oauth/access-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_CLIENT_ID,
        client_secret: process.env.VERCEL_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      console.error("[vercel-callback] Token exchange failed:", tokenData?.error ?? tokenData);
      return backToApp(req, { vercel: "error", reason: "token_exchange_failed" });
    }

    const userRes = await fetch("https://api.vercel.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const vercelUser = await userRes.json();
    const email = vercelUser?.email ?? null;
    const userIdent = email?.split("@")?.[0] ?? "unknown";

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase
      .from("vercel_connections")
      .upsert(
        {
          user_id: userId,
          vercel_username: email,
          access_token: encryptIntegrationToken(accessToken),
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      // Fallback if the unique index on user_id is missing: remove any old
      // row and insert fresh.
      console.error("[vercel-callback] Upsert failed, trying delete+insert:", upsertError.message);
      const { error: deleteError } = await supabase.from("vercel_connections").delete().eq("user_id", userId);
      if (deleteError) {
        console.error("[vercel-callback] Delete fallback failed:", deleteError.message);
        return backToApp(req, { vercel: "error", reason: "save_failed" });
      }
      const { error: insertError } = await supabase.from("vercel_connections").insert({
        user_id: userId,
        vercel_username: email,
        access_token: encryptIntegrationToken(accessToken),
        connected_at: new Date().toISOString(),
      });
      if (insertError) {
        console.error("[vercel-callback] Insert fallback failed:", insertError.message);
        return backToApp(req, { vercel: "error", reason: "save_failed" });
      }
    }

    return backToApp(req, { vercel: "connected", user: userIdent });
  } catch (err) {
    console.error("[vercel-callback] Unexpected error:", err);
    return backToApp(req, { vercel: "error", reason: "unexpected" });
  }
}
