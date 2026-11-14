import { NextRequest } from "next/server";
import { refreshTodayNews } from "@/lib/news.server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function runRefresh(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized refresh request." }, { status: 401 });
  }
  try {
    const edition = await refreshTodayNews(true);
    return Response.json({ success: true, editionDate: edition.editionDate, articles: edition.articles.length });
  } catch (error) {
    console.error("[news] scheduled refresh failed", error);
    return Response.json({ error: "News refresh failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return runRefresh(request);
}

export async function POST(request: NextRequest) {
  return runRefresh(request);
}
