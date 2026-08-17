import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  // GitHub App installation URL or OAuth upgrade prompt.
  // When the user configures a GitHub App slug (e.g., process.env.GITHUB_APP_SLUG),
  // this redirects to https://github.com/apps/{slug}/installations/new?state={userId}.
  // If no GitHub App slug is configured yet, it gracefully guides the user or redirects
  // to the GitHub App setup page with a clear callback payload.
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (appSlug) {
    const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    installUrl.searchParams.set("state", userId);
    return NextResponse.redirect(installUrl.toString());
  }

  // Fallback: if GitHub App slug is pending, redirect back to integrations with an explanatory notice
  const origin = req.nextUrl.origin;
  const returnUrl = new URL(`${origin}/?github_upgrade=pending&userId=${encodeURIComponent(userId)}`);
  return NextResponse.redirect(returnUrl.toString());
}
