const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const SEARCH_LIMIT = 5;
const ARTICLE_VERIFY_LIMIT = 3;
const TIMEOUT_MS = 7000;

export type WikipediaResult = {
  pageId: number;
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

async function request(params: URLSearchParams) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${WIKIPEDIA_API}?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "NEXO-AI/1.0 (knowledge integration)" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Wikipedia request failed (${response.status}).`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchWikipedia(query: string): Promise<WikipediaResult[]> {
  const q = clean(query, 200);
  if (!q) return [];
  const params = new URLSearchParams({ action: "query", list: "search", srsearch: q, srlimit: String(SEARCH_LIMIT), format: "json", formatversion: "2", origin: "*" });
  const data = await request(params);
  const rows = Array.isArray(data?.query?.search) ? data.query.search : [];
  return rows.slice(0, SEARCH_LIMIT).map((row: any) => {
    const title = clean(row?.title, 200);
    return {
      pageId: Number(row?.pageid) || 0,
      title,
      extract: clean(row?.snippet, 500).replace(/<[^>]*>/g, ""),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    };
  }).filter((item: WikipediaResult) => item.title && item.url);
}

export async function searchWikipediaWithVerifiedArticles(query: string): Promise<WikipediaResult[]> {
  const searchResults = await searchWikipedia(query);
  const candidates = searchResults.filter((result) => result.pageId > 0).slice(0, ARTICLE_VERIFY_LIMIT);
  const verified = await Promise.all(candidates.map((result) => getWikipediaArticle(result.pageId)));
  const verifiedByPageId = new Map(
    verified.filter((article): article is WikipediaResult => Boolean(article)).map((article) => [article.pageId, article])
  );
  return searchResults.map((result) => verifiedByPageId.get(result.pageId) ?? result);
}

export async function getWikipediaArticle(pageId: number): Promise<WikipediaResult | null> {
  if (!Number.isInteger(pageId) || pageId <= 0) return null;
  const params = new URLSearchParams({ action: "query", pageids: String(pageId), prop: "extracts|pageimages", exintro: "1", explaintext: "1", exchars: "3500", piprop: "thumbnail", pithumbsize: "480", format: "json", formatversion: "2" });
  const data = await request(params);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  const title = clean(page.title, 200);
  return {
    pageId,
    title,
    extract: clean(page.extract, 3500),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    thumbnail: clean(page?.thumbnail?.source, 1000) || undefined,
  };
}
