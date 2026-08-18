import "server-only";
import { createSign } from "crypto";

export const GITHUB_API_VERSION = "2026-03-10";

export type GitHubCredentialSource = "github-app" | "oauth";

export interface GitHubInstallationToken {
  token: string;
  expiresAt: string;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function githubAppConfiguration() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  return { appId, privateKey };
}

export function isGitHubAppConfigured(): boolean {
  const { appId, privateKey } = githubAppConfiguration();
  return Boolean(appId && privateKey);
}

/**
 * GitHub App JWTs are deliberately short-lived and are never persisted.
 * GitHub requires an RS256 token whose exp is no more than ten minutes after iat.
 */
export function createGitHubAppJwt(now = Math.floor(Date.now() / 1000)): string {
  const { appId, privateKey } = githubAppConfiguration();
  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials are not configured.");
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

export function githubApiHeaders(token: string, includeJsonContentType = false): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
  };
}

/**
 * Exchanges a server-signed App JWT for a GitHub installation access token.
 * The returned token is scoped by the repositories and permissions selected
 * during installation and expires in roughly one hour, so it is never stored.
 */
export async function createInstallationAccessToken(installationId: string): Promise<GitHubInstallationToken> {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Saved GitHub App installation reference is invalid.");
  }

  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: githubApiHeaders(createGitHubAppJwt(), true),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { token?: string; expires_at?: string; message?: string }
    | null;

  if (!response.ok || !payload?.token || !payload.expires_at) {
    console.error("[github-app] Installation token exchange failed", {
      status: response.status,
      message: payload?.message,
    });
    throw new Error("GitHub App installation could not be used. Reinstall the App or reconnect GitHub.");
  }

  return { token: payload.token, expiresAt: payload.expires_at };
}
