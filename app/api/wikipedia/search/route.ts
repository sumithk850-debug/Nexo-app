import { NextRequest, NextResponse } from "next/server";
import { searchWikipedia, getWikipediaArticle } from "@/lib/wikipedia.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { requireWikipediaAccess, wikipediaAccessErrorMessage } from "@/lib/wikipediaGate.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const requestedUserId = typeof body?.userId === "string" ? body.userId : null;
  const verified = requestedUserId ? await requireVerifiedUser(request, requestedUserId) : null;
  if (verified?.response) return verified.response;
  if (!verified?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    await requireWikipediaAccess(verified.user.id);

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
    const message = wikipediaAccessErrorMessage(error);
    if (message.includes("disabled")) {
      return NextResponse.json({ error: message, code: "WIKIPEDIA_DISABLED" }, { status: 403 });
    }
    const timeout = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: timeout ? "Wikipedia request timed out." : "Wikipedia is temporarily unavailable." },
      { status: 502 }
    );
  }
}
