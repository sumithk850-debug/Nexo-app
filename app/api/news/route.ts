import { NextRequest } from "next/server";
import { refreshTodayNews } from "@/lib/news.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const verified = await requireVerifiedUser(request);
  if (verified.response) return verified.response;
  try {
    const edition = await refreshTodayNews(false);
    return Response.json(edition, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("[news] failed to load edition", error);
    return Response.json({ error: "Today's news edition is temporarily unavailable." }, { status: 503 });
  }
}
