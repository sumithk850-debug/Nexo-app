import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type SignedResearchPayload = {
  userId: string;
  query: string;
  context: string;
  issuedAt: number;
};

function signingSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) throw new Error("Server signing secret is unavailable.");
  return secret;
}

export function signWebResearchContext(userId: string, query: string, context: string): string {
  const payload: SignedResearchPayload = {
    userId,
    query: query.trim().slice(0, 4_000),
    context: context.slice(0, 28_000),
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

export function verifyWebResearchContext(token: unknown, userId: string, expectedQuery: string): string | null {
  if (typeof token !== "string" || token.length > 45_000) return null;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra !== undefined) return null;
  try {
    const expectedSignature = createHmac("sha256", signingSecret()).update(encoded).digest();
    const actualSignature = Buffer.from(suppliedSignature, "base64url");
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedResearchPayload;
    if (
      payload.userId !== userId ||
      payload.query !== expectedQuery.trim().slice(0, 4_000) ||
      !Number.isFinite(payload.issuedAt) ||
      Date.now() - payload.issuedAt > 10 * 60 * 1000 ||
      payload.issuedAt > Date.now() + 30_000 ||
      typeof payload.context !== "string" ||
      payload.context.length > 28_000
    ) return null;
    return payload.context;
  } catch {
    return null;
  }
}
