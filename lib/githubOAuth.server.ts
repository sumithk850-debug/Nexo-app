import "server-only";

import { decryptGithubToken } from "@/lib/githubToken.server";
import { githubApiHeaders } from "@/lib/githubApp.server";

export interface GitHubOAuthWriteCheck {
  canWrite: boolean;
  reason: "ok" | "token_unavailable" | "repository_unavailable" | "push_denied";
}

/**
 * Decrypts a stored per-user OAuth token only inside a server route. The token
 * never leaves this process or reaches the browser.
 */
export function resolveGithubOAuthToken(storedToken: string | null | undefined): string | null {
  if (!storedToken) return null;
  try {
    return decryptGithubToken(storedToken);
  } catch {
    return null;
  }
}

/**
 * GitHub returns the authenticated user's effective repository permission on
 * GET /repos/{owner}/{repo}. `permissions.push` is the authoritative check for
 * the selected repository, so a broad OAuth scope alone never grants a write.
 */
export async function checkGithubOAuthRepositoryWrite(
  accessToken: string,
  repository: string
): Promise<GitHubOAuthWriteCheck> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: githubApiHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) {
      return { canWrite: false, reason: "repository_unavailable" };
    }

    const payload = (await response.json()) as { permissions?: { push?: boolean } };
    return payload.permissions?.push === true
      ? { canWrite: true, reason: "ok" }
      : { canWrite: false, reason: "push_denied" };
  } catch {
    return { canWrite: false, reason: "repository_unavailable" };
  }
}
