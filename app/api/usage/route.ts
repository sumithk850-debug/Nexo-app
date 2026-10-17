import { NextRequest } from "next/server";
import { getDailyUsage, DAILY_LIMITS } from "@/lib/rateLimits.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = request.headers.get("x-session-id")?.trim() ?? "";

  // Usage is written by /api/chat using the client chat session ID. User IDs
  // are intentionally not used here: querying by a user ID creates a different
  // lookup key and makes a real session's dashboard incorrectly show zero.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(JSON.stringify({ error: "Invalid or missing session" }), { status: 401 });
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
