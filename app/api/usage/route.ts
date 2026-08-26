import { NextRequest } from "next/server";
import { getDailyUsage, DAILY_LIMITS } from "@/lib/rateLimits.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const verified = await requireVerifiedUser(request);
  if (verified.response) return verified.response;

  // The scope is derived solely from the verified bearer token. A browser
  // cannot select another account's dashboard by supplying a session header.
  const usage = await getDailyUsage(`user:${verified.user.id}`);

  return new Response(
    JSON.stringify({ usage, limits: DAILY_LIMITS }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }
  );
}
