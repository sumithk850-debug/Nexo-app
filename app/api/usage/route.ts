import { NextRequest } from "next/server";
import { getDailyUsage, DAILY_LIMITS } from "@/lib/rateLimits.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = request.headers.get("x-session-id")?.trim() ?? "";

  // Usage is written by /api/chat using the client chat session ID. User IDs
  // are intentionally not used here: querying by a user ID creates a different
  // lookup key and makes a real session's dashboard incorrectly show zero.
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session" }), { status: 401 });
  }

  const usage = await getDailyUsage(sessionId);

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
