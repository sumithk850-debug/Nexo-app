import { NextResponse } from "next/server";
import { searchWikipedia, getWikipediaArticle } from "@/lib/wikipedia.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const pageId = body?.pageId;
    if (query.length > 200) return NextResponse.json({ error: "Wikipedia query is too long." }, { status: 400 });
    if (!query && !Number.isInteger(pageId)) return NextResponse.json({ error: "A search query or pageId is required." }, { status: 400 });

    if (Number.isInteger(pageId)) {
      const article = await getWikipediaArticle(pageId);
      if (!article) return NextResponse.json({ article: null, error: "Wikipedia article was not found." }, { status: 404 });
      return NextResponse.json({ article }, { headers: { "Cache-Control": "private, max-age=300" } });
    }

    const results = await searchWikipedia(query);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Wikipedia request timed out." : "Wikipedia is temporarily unavailable.";
    console.error("Wikipedia integration error:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
