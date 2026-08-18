import { NextRequest, NextResponse } from "next/server";
import { isGitHubAppCredentialConfigured } from "@/lib/githubApp.server";
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
  if (appSlug && isGitHubAppCredentialConfigured()) {
    const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    installUrl.searchParams.set("state", createOAuthState(verified.user.id, "github"));
    return NextResponse.json({ authorizationUrl: installUrl.toString(), mode: "app" });
  }

  // Backward-compatible fallback for existing OAuth-only users. It gives the
  // connected account an explicit chance to grant repository write scope when
  // the server cannot mint GitHub App installation tokens yet.
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "GitHub write access is not configured on this deployment." }), { status: 503 });
  }
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/github/callback`);
  authUrl.searchParams.set("scope", "repo read:user");
  authUrl.searchParams.set("state", createOAuthState(verified.user.id, "github"));
  return NextResponse.json({ authorizationUrl: authUrl.toString(), mode: "oauth-write" });
}
