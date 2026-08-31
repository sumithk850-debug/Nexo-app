const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const SEARCH_LIMIT = 5;
const TIMEOUT_MS = 7000;

export type WikipediaResult = {
  pageId: number;
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
};

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function stripWikiMarkup(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function articleUrl(title: string, fullUrl?: unknown): string {
  if (typeof fullUrl === "string" && /^https:\/\/en\.wikipedia\.org\/wiki\//.test(fullUrl)) return fullUrl;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

async function request(params: URLSearchParams): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${WIKIPEDIA_API}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "NEXO-AI/1.0 (Wikipedia knowledge integration)",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Wikipedia request failed (${response.status}).`);
    const data = await response.json();
    if (!data || typeof data !== "object") throw new Error("Wikipedia returned an invalid response.");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchWikipedia(query: string): Promise<WikipediaResult[]> {
  const q = clean(query, 200);
  if (!q) return [];

  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: q,
    srlimit: String(SEARCH_LIMIT),
    srprop: "snippet",
    format: "json",
    formatversion: "2",
  });
  const data = await request(params);
  const rows = Array.isArray(data?.query?.search) ? data.query.search : [];

  return rows
    .slice(0, SEARCH_LIMIT)
    .map((row: any) => {
      const pageId = Number(row?.pageid);
      const title = clean(row?.title, 200);
      return {
        pageId: Number.isInteger(pageId) && pageId > 0 ? pageId : 0,
        title,
        extract: stripWikiMarkup(row?.snippet, 500),
        url: articleUrl(title),
      } satisfies WikipediaResult;
    })
    .filter((item: WikipediaResult) => item.pageId > 0 && Boolean(item.title));
}

export async function getWikipediaArticle(pageId: number): Promise<WikipediaResult | null> {
  if (!Number.isInteger(pageId) || pageId <= 0) return null;

  const params = new URLSearchParams({
    action: "query",
    pageids: String(pageId),
    prop: "extracts|pageimages|info",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exchars: "3500",
    piprop: "thumbnail",
    pithumbsize: "480",
    format: "json",
    formatversion: "2",
  });
  const data = await request(params);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;

  const title = clean(page.title, 200);
  if (!title) return null;

  return {
    pageId,
    title,
    extract: clean(page.extract, 3500),
    url: articleUrl(title, page.fullurl),
    thumbnail: clean(page?.thumbnail?.source, 1000) || undefined,
  };
}
