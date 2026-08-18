import { NextRequest, NextResponse } from "next/server";
import { isGitHubAppConfigured } from "@/lib/githubApp.server";
import { createOAuthState } from "@/lib/oauthState.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

const UPGRADE_STATE_COOKIE = "nexo_github_upgrade_state";

export async function POST(req: NextRequest) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  if (!appSlug || !isGitHubAppConfigured()) {
    return NextResponse.json(
      { error: "GitHub Read & Write Access is not configured on this service yet." },
      { status: 503 }
    );
  }

  // GitHub sends installers to the App's configured Setup URL after installation.
  // Keep the signed initiating-user state in a first-party, short-lived Lax cookie
  // so it survives that top-level return even when GitHub does not echo custom query
  // parameters from the installation URL.
  const installUrl = `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`;
  const response = NextResponse.json({ authorizationUrl: installUrl });
  response.cookies.set({
    name: UPGRADE_STATE_COOKIE,
    value: createOAuthState(verified.user.id, "github"),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/github/app-callback",
    maxAge: 15 * 60,
  });
  return response;
}
