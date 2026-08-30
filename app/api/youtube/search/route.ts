import { NextRequest } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { searchYouTube, YouTubeConfigError, YouTubeQuotaError } from "@/lib/youtube.server";

export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 100;

export async function GET(req: NextRequest) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const rawMaxResults = Number(req.nextUrl.searchParams.get("maxResults") ?? "6");

  if (!query) {
    return Response.json({ error: "A YouTube search query is required." }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: "The YouTube search query is too long." }, { status: 400 });
  }

  try {
    const results = await searchYouTube(query, Number.isFinite(rawMaxResults) ? rawMaxResults : 6);
    return Response.json({ results, source: "YouTube" }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error) {
    if (error instanceof YouTubeConfigError) {
      return Response.json({ error: "YouTube integration is not configured yet." }, { status: 503 });
    }
    if (error instanceof YouTubeQuotaError) {
      return Response.json({ error: "YouTube search quota is temporarily unavailable. Please try again later." }, { status: 429 });
    }
    return Response.json({ error: "Could not search YouTube right now." }, { status: 502 });
  }
}
