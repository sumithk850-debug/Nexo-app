import { NextRequest } from "next/server";
import { getDailyUsage, DAILY_LIMITS } from "@/lib/rateLimits.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = request.headers.get("x-session-id") ?? "";
  const userId = request.nextUrl.searchParams.get("userId") ?? "";

  if (!sessionId && !userId) {
    return new Response(JSON.stringify({ error: "Missing session" }), { status: 401 });
  }

  // Try userId first, then sessionId
  const identifier = userId || sessionId;
  const usage = await getDailyUsage(identifier);

  return new Response(
    JSON.stringify({
      usage,
      limits: DAILY_LIMITS,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
