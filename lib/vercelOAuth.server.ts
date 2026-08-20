import "server-only";
import { createHash, randomBytes } from "crypto";

export const VERCEL_PKCE_COOKIE = "nexo_vercel_oauth_verifier";
export const VERCEL_PKCE_MAX_AGE_SECONDS = 10 * 60;

export function createVercelPkce() {
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function vercelPkceCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/api/vercel",
    maxAge: VERCEL_PKCE_MAX_AGE_SECONDS,
  };
}
