import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

type OAuthProvider = "github" | "supabase" | "vercel";
const MAX_AGE_MS = 10 * 60 * 1000;

function stateKey() {
  const material = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || process.env.GITHUB_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!material) throw new Error("Secure OAuth state signing is not configured.");
  return createHash("sha256").update(material).digest();
}

export function createOAuthState(userId: string, provider: OAuthProvider) {
  const payload = Buffer.from(JSON.stringify({ v: 1, u: userId, p: provider, t: Date.now(), n: randomBytes(16).toString("base64url") })).toString("base64url");
  const signature = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string | null, provider: OAuthProvider): string | null {
  if (!state) return null;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: number; u?: string; p?: string; t?: number };
    if (decoded.v !== 1 || decoded.p !== provider || typeof decoded.u !== "string" || !decoded.u || typeof decoded.t !== "number") return null;
    if (Date.now() - decoded.t < 0 || Date.now() - decoded.t > MAX_AGE_MS) return null;
    return decoded.u;
  } catch {
    return null;
  }
}
