import { createSign } from "crypto";
import { decryptGithubToken } from "./githubToken.server";

export interface GitHubConnectionCredential {
  access_token?: string | null;
  installation_id?: string | number | null;
}

export interface GitHubResolvedCredential {
  token: string;
  source: "installation" | "oauth";
  canWrite: boolean;
  permissions?: Record<string, string>;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function githubAppPrivateKey() {
  const value = process.env.GITHUB_APP_PRIVATE_KEY;
  return value?.replace(/\\n/g, "\n") ?? "";
}

export function isGitHubAppCredentialConfigured() {
  return Boolean(process.env.GITHUB_APP_ID && githubAppPrivateKey());
}

function createAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = githubAppPrivateKey();
  if (!appId || !privateKey) {
    throw new Error("GitHub App server credentials are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  return `${encodedHeader}.${encodedPayload}.${signer.sign(privateKey).toString("base64url")}`;
}

async function getInstallationCredential(installationId: string | number): Promise<GitHubResolvedCredential> {
  const response = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(String(installationId))}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${createAppJwt()}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { token?: string; permissions?: Record<string, string>; message?: string } | null;
  if (!response.ok || !payload?.token) {
    throw new Error(payload?.message || "GitHub App could not create an installation access token.");
  }
  return {
    token: payload.token,
    source: "installation",
    canWrite: payload.permissions?.contents === "write",
    permissions: payload.permissions,
  };
}

async function getOAuthCredential(accessToken: string): Promise<GitHubResolvedCredential> {
  const token = decryptGithubToken(accessToken);
  const response = await fetch("https://api.github.com/user", {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const scopes = response.headers.get("x-oauth-scopes") ?? "";
  const canWrite = scopes.split(",").map((scope) => scope.trim()).some((scope) => scope === "repo" || scope === "public_repo");
  return { token, source: "oauth", canWrite };
}

export async function resolveGitHubCredential(
  connection: GitHubConnectionCredential,
  requirement: "read" | "write" = "read",
): Promise<GitHubResolvedCredential> {
  if (connection.installation_id && isGitHubAppCredentialConfigured()) {
    const installation = await getInstallationCredential(connection.installation_id);
    if (requirement === "read" || installation.canWrite) return installation;
  }

  if (connection.access_token) {
    const oauth = await getOAuthCredential(connection.access_token);
    if (requirement === "read" || oauth.canWrite) return oauth;
  }

  if (connection.installation_id && !isGitHubAppCredentialConfigured()) {
    throw new Error("GitHub App installation is linked, but its server credentials are not configured.");
  }
  throw new Error(requirement === "write" ? "GitHub write permission is not available for this connection." : "GitHub access is not available for this connection.");
}

export async function getGitHubWriteCapability(connection: GitHubConnectionCredential) {
  try {
    const credential = await resolveGitHubCredential(connection, "write");
    return { canWrite: credential.canWrite, source: credential.source, configurationMissing: false };
  } catch (error) {
    return {
      canWrite: false,
      source: null,
      configurationMissing: Boolean(connection.installation_id && !isGitHubAppCredentialConfigured()),
      error: error instanceof Error ? error.message : "GitHub write permission could not be verified.",
    };
  }
}
