import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauthState.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  // GitHub App installation URL or OAuth upgrade prompt.
  // When the user configures a GitHub App slug (e.g., process.env.GITHUB_APP_SLUG),
  // this redirects to GitHub with a short-lived signed state bound to the
  // initiating Nexo user.
  // If no GitHub App slug is configured yet, it gracefully guides the user or redirects
  // to the GitHub App setup page with a clear callback payload.
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (appSlug) {
    const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    installUrl.searchParams.set("state", createOAuthState(verified.user.id, "github"));
    return NextResponse.json({ authorizationUrl: installUrl.toString() });
  }

  // Fallback: if GitHub App slug is pending, redirect back to integrations with an explanatory notice
  const origin = req.nextUrl.origin;
  const returnUrl = new URL(`${origin}/?github_upgrade=pending`);
  return NextResponse.json({ authorizationUrl: returnUrl.toString() });
}
