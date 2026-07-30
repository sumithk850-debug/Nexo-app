import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function debugPage(title: string, rows: Record<string, string>) {
  const rowsHtml = Object.entries(rows)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px;color:#00E5FF;font-weight:bold;vertical-align:top;">${k}</td><td style="padding:8px;white-space:pre-wrap;word-break:break-all;">${v}</td></tr>`
    )
    .join("");
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:monospace;padding:20px;background:#0A0E1A;color:#E8ECFB;">
      <h2 style="color:#00E5FF;">${title}</h2>
      <table style="border-collapse:collapse;width:100%;">${rowsHtml}</table>
      <br/><a href="/" style="color:#00E5FF;">← Back to NEXO AI</a>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  const envCheck = {
    "code received": String(!!code),
    "state (userId) received": String(userId),
    "GITHUB_OAUTH_CLIENT_ID set": String(!!process.env.GITHUB_OAUTH_CLIENT_ID),
    "GITHUB_OAUTH_CLIENT_SECRET set": String(!!process.env.GITHUB_OAUTH_CLIENT_SECRET),
    "SUPABASE_SERVICE_ROLE_KEY set": String(!!process.env.SUPABASE_SERVICE_ROLE_KEY),
    "SUPABASE_SERVICE_ROLE_KEY prefix": (process.env.SUPABASE_SERVICE_ROLE_KEY || "MISSING").slice(0, 20) + "...",
    "NEXT_PUBLIC_SUPABASE_URL": process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
  };

  if (!code || !userId) {
    return debugPage("Missing code or userId", envCheck);
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return debugPage("Token exchange failed", {
        ...envCheck,
        "GitHub token response": JSON.stringify(tokenData),
      });
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    const githubUser = await userRes.json();
    const githubUsername = githubUser.login ?? "unknown";

    const supabase = getSupabaseAdmin();
    const { data: upsertData, error: upsertError } = await supabase
      .from("github_connections")
      .upsert(
        {
          user_id: userId,
          github_username: githubUsername,
          access_token: accessToken,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select();

    return debugPage("Callback completed — final state", {
      ...envCheck,
      "GitHub username": githubUsername,
      "Access token received": String(!!accessToken),
      "Supabase upsert error": upsertError ? JSON.stringify(upsertError) : "none",
      "Supabase upsert data": JSON.stringify(upsertData),
    });
  } catch (err) {
    return debugPage("Exception thrown", { ...envCheck, "Error": String(err) });
  }
}
