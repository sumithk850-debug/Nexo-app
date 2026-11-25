import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NativeToolLoopResult } from "@/lib/nativeTools.server";

type VerifiedNativeToolContext = Pick<NativeToolLoopResult, "contextBlock" | "usedTools" | "githubActivities" | "actionEvents">;
type SignedNativeToolPayload = VerifiedNativeToolContext & { userId: string; query: string; issuedAt: number };

const MAX_TOKEN_CHARS = 90_000;

function signingSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) throw new Error("Server signing secret is unavailable.");
  return secret;
}

export function signNativeToolContext(input: { userId: string; query: string; result: NativeToolLoopResult }): string {
  const payload: SignedNativeToolPayload = {
    userId: input.userId,
    query: input.query.trim().slice(0, 4_000),
    contextBlock: input.result.contextBlock.slice(0, 24_000),
    usedTools: input.result.usedTools.slice(0, 20),
    githubActivities: (input.result.githubActivities ?? []).slice(0, 8),
    actionEvents: (input.result.actionEvents ?? []).slice(0, 24),
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

export function verifyNativeToolContext(token: unknown, userId: string | undefined, expectedQuery: string): VerifiedNativeToolContext | null {
  if (!userId || typeof token !== "string" || token.length > MAX_TOKEN_CHARS) return null;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra !== undefined) return null;
  try {
    const expectedSignature = createHmac("sha256", signingSecret()).update(encoded).digest();
    const actualSignature = Buffer.from(suppliedSignature, "base64url");
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedNativeToolPayload;
    if (
      payload.userId !== userId ||
      payload.query !== expectedQuery.trim().slice(0, 4_000) ||
      !Number.isFinite(payload.issuedAt) ||
      Date.now() - payload.issuedAt > 10 * 60 * 1000 ||
      payload.issuedAt > Date.now() + 30_000 ||
      typeof payload.contextBlock !== "string" ||
      !Array.isArray(payload.usedTools) ||
      !Array.isArray(payload.githubActivities) ||
      !Array.isArray(payload.actionEvents)
    ) return null;
    return {
      contextBlock: payload.contextBlock,
      usedTools: payload.usedTools,
      githubActivities: payload.githubActivities,
      actionEvents: payload.actionEvents,
    };
  } catch {
    return null;
  }
}
