import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin.server";

type NewsCategory = "World" | "Technology" | "Science" | "Business" | "Culture" | "Climate";
export type NewsArticle = {
  id: string;
  category: NewsCategory;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: string | null;
  rank: number;
};
export type NewsEdition = {
  id: string;
  editionDate: string;
  headline: string;
  intro: string;
  refreshedAt: string;
  articles: NewsArticle[];
};

type Feed = { category: NewsCategory; name: string; url: string };
type RawArticle = { category: NewsCategory; title: string; description: string; sourceName: string; sourceUrl: string; imageUrl: string | null; publishedAt: string | null; guid: string };

// Broad editorial coverage: each source is independent, so an outage in one feed never blocks the edition.
const FEEDS: Feed[] = [
  { category: "World", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { category: "World", name: "BBC Politics", url: "https://feeds.bbci.co.uk/news/politics/rss.xml" },
  { category: "World", name: "BBC Middle East", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml" },
  { category: "World", name: "BBC Asia", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml" },
  { category: "World", name: "BBC Europe", url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml" },
  { category: "World", name: "The Guardian World", url: "https://www.theguardian.com/world/rss" },
  { category: "World", name: "The Guardian US", url: "https://www.theguardian.com/us-news/rss" },
  { category: "World", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { category: "World", name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml" },
  { category: "World", name: "DW World", url: "https://rss.dw.com/rdf/rss-en-world" },
  { category: "World", name: "France 24", url: "https://www.france24.com/en/rss" },
  { category: "World", name: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml" },
  { category: "World", name: "The Conversation Global", url: "https://theconversation.com/global/articles.atom" },
  { category: "World", name: "Google News World", url: "https://news.google.com/rss/headlines/section/topic/WORLD" },
  { category: "Technology", name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { category: "Technology", name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { category: "Technology", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { category: "Technology", name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/" },
  { category: "Technology", name: "Wired", url: "https://www.wired.com/feed/rss" },
  { category: "Technology", name: "Engadget", url: "https://www.engadget.com/rss.xml" },
  { category: "Technology", name: "Hacker News", url: "https://hnrss.org/frontpage" },
  { category: "Technology", name: "The Register", url: "https://www.theregister.com/headlines.atom" },
  { category: "Technology", name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  { category: "Technology", name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/feed.rss" },
  { category: "Technology", name: "Google News Technology", url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY" },
  { category: "Science", name: "ScienceDaily Top Science", url: "https://www.sciencedaily.com/rss/top/science.xml" },
  { category: "Science", name: "ScienceDaily Health", url: "https://www.sciencedaily.com/rss/health_medicine.xml" },
  { category: "Science", name: "NASA Breaking News", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss" },
  { category: "Science", name: "Nature News", url: "https://www.nature.com/nature.rss" },
  { category: "Science", name: "New Scientist", url: "https://www.newscientist.com/feed/home/" },
  { category: "Science", name: "Phys.org", url: "https://phys.org/rss-feed/" },
  { category: "Science", name: "Scientific American", url: "https://rss.sciam.com/ScientificAmerican" },
  { category: "Science", name: "Live Science", url: "https://www.livescience.com/feeds/all" },
  { category: "Science", name: "EurekAlert", url: "https://www.eurekalert.org/rss.xml" },
  { category: "Business", name: "The Guardian Business", url: "https://www.theguardian.com/business/rss" },
  { category: "Business", name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { category: "Business", name: "CNBC Top News", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { category: "Business", name: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  { category: "Business", name: "Fortune", url: "https://fortune.com/feed/" },
  { category: "Business", name: "Entrepreneur", url: "https://www.entrepreneur.com/latest.rss" },
  { category: "Business", name: "Investing.com", url: "https://www.investing.com/rss/news.rss" },
  { category: "Business", name: "Google News Business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS" },
  { category: "Culture", name: "The Guardian Culture", url: "https://www.theguardian.com/culture/rss" },
  { category: "Culture", name: "NPR Arts & Culture", url: "https://feeds.npr.org/1008/rss.xml" },
  { category: "Culture", name: "NPR Music", url: "https://feeds.npr.org/1039/rss.xml" },
  { category: "Culture", name: "Smithsonian", url: "https://www.smithsonianmag.com/rss/latest_articles/" },
  { category: "Climate", name: "The Guardian Environment", url: "https://www.theguardian.com/environment/climate-crisis/rss" },
  { category: "Climate", name: "BBC Science & Environment", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { category: "Climate", name: "NASA Climate", url: "https://climate.nasa.gov/news.rss" },
  { category: "Climate", name: "Climate Home News", url: "https://www.climatechangenews.com/feed/" },
  { category: "Climate", name: "Carbon Brief", url: "https://www.carbonbrief.org/feed/" },
  { category: "Climate", name: "Mongabay", url: "https://news.mongabay.com/feed/" },
];
const MAX_ARTICLES = 60;
const USER_AGENT = "KyvorixAI-DailyNews/2.0 (+https://nexo-app-delta.vercel.app)";

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}
function imageFromBlock(block: string): string | null {
  const media = block.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i)?.[1];
  if (media) return media;
  const htmlImage = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  return htmlImage ?? null;
}
function parseFeed(xml: string, feed: Feed): RawArticle[] {
  const blocks = [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0, 10);
  return blocks.map((match) => {
    const block = match[1];
    const title = tag(block, "title");
    const sourceUrl = tag(block, "link") || block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || tag(block, "guid");
    const description = tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded") || tag(block, "content");
    const published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
    if (!title || !sourceUrl) return null;
    const parsedDate = published ? new Date(published) : null;
    return { category: feed.category, title: title.slice(0, 240), description: description.slice(0, 2_400), sourceName: feed.name, sourceUrl, imageUrl: imageFromBlock(block), publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null, guid: tag(block, "guid") || tag(block, "id") || sourceUrl } satisfies RawArticle;
  }).filter((item): item is RawArticle => Boolean(item));
}
function fallbackSummary(article: RawArticle): string {
  const description = article.description.replace(/https?:\/\/\S+/g, "").trim();
  if (!description) return `Kyvorix AI identified this as a notable ${article.category.toLowerCase()} story. Read the source for the full reporting and latest developments.`;
  const clean = description.length > 360 ? `${description.slice(0, 357).replace(/\s+\S*$/, "")}…` : description;
  return `Kyvorix AI summary: ${clean}`;
}
async function summarize(article: RawArticle): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallbackSummary(article);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://nexo-app-delta.vercel.app", "X-Title": "Kyvorix AI Daily News" }, body: JSON.stringify({ model: "openai/gpt-oss-20b:free", temperature: 0.2, max_tokens: 140, messages: [{ role: "system", content: "You are Kyvorix AI's editorial summarizer. Summarize the supplied news item in 2 clear sentences for a general reader. Do not invent facts, do not add a headline, and mention uncertainty when the source description is incomplete." }, { role: "user", content: `Category: ${article.category}\nTitle: ${article.title}\nSource description: ${article.description}` }] }), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return fallbackSummary(article);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? `Kyvorix AI summary: ${content.slice(0, 700)}` : fallbackSummary(article);
  } catch { return fallbackSummary(article); }
}
async function collectArticles(): Promise<RawArticle[]> {
  const responses = await Promise.allSettled(FEEDS.map(async (feed) => {
    const response = await fetch(feed.url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, text/xml" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Feed ${feed.name} returned ${response.status}`);
    return parseFeed(await response.text(), feed);
  }));
  const articles = responses.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = article.title.toLowerCase().replace(/\W/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, MAX_ARTICLES);
}
function utcDate(): string { return new Date().toISOString().slice(0, 10); }

export function isDailyNewsRequest(query: string): boolean {
  return /\b(?:today'?s?|daily|latest|current|breaking|world)\s+(?:news|headlines|events|briefing|update)s?\b/i.test(query) || /\b(?:news|headlines|current events)\b/i.test(query) || /අද.*(?:නිවුස්|නිව්ස්|පුවත්|ප්‍රවෘත්ති)|(?:නිවුස්|නිව්ස්|පුවත්|ප්‍රවෘත්ති).*(?:අද|නවතම|අලුත්ම)|ලෝකයේ.*(?:පුවත්|නිව්ස්)|දවසේ.*(?:පුවත්|නිව්ස්)/i.test(query);
}

export async function refreshTodayNews(force = false): Promise<NewsEdition> {
  const admin = getSupabaseAdmin();
  const editionDate = utcDate();
  const existing = await admin.from("news_editions").select("id, edition_date, headline, intro, refreshed_at").eq("edition_date", editionDate).eq("status", "published").maybeSingle();
  if (!force && existing.data) {
    const articles = await admin.from("news_articles").select("id, category, title, summary, source_name, source_url, image_url, published_at, rank").eq("edition_id", existing.data.id).order("rank", { ascending: true }).limit(MAX_ARTICLES);
    return normalizeEdition(existing.data, articles.data ?? []);
  }
  const raw = await collectArticles();
  if (raw.length === 0 && existing.data) return refreshTodayNews(false);
  if (raw.length === 0) throw new Error("No trusted news feeds returned articles.");
  // Bound summarization concurrency to protect provider limits while still processing a large edition quickly.
  const summarized: Array<RawArticle & { summary: string; rank: number }> = [];
  for (let index = 0; index < raw.length; index += 6) {
    const batch = await Promise.all(raw.slice(index, index + 6).map(async (article, offset) => ({ ...article, summary: await summarize(article), rank: index + offset })));
    summarized.push(...batch);
  }
  const now = new Date().toISOString();
  const { data: edition, error: editionError } = await admin.from("news_editions").upsert({ edition_date: editionDate, status: "published", headline: "Daily News Summarization by Kyvorix AI", intro: "A broad, balanced briefing gathered from 50+ independent sources and distilled by Kyvorix AI.", generated_at: now, refreshed_at: now }, { onConflict: "edition_date" }).select("id, edition_date, headline, intro, refreshed_at").single();
  if (editionError || !edition) throw new Error("Could not save today's news edition.");
  await admin.from("news_articles").delete().eq("edition_id", edition.id);
  const { error: articleError } = await admin.from("news_articles").insert(summarized.map(({ category, title, summary, sourceName, sourceUrl, imageUrl, publishedAt, guid, rank }) => ({ edition_id: edition.id, category, title, summary, source_name: sourceName, source_url: sourceUrl, image_url: imageUrl, published_at: publishedAt, source_guid: guid, rank })));
  if (articleError) throw new Error("Could not save today's news articles.");
  return normalizeEdition(edition, summarized.map((item, index) => ({ id: `${edition.id}-${index}`, category: item.category, title: item.title, summary: item.summary, source_name: item.sourceName, source_url: item.sourceUrl, image_url: item.imageUrl, published_at: item.publishedAt, rank: item.rank })));
}

export async function getTodayNewsContext(): Promise<string> {
  try {
    const edition = await refreshTodayNews(false);
    const articles = edition.articles.slice(0, 36);
    return `Edition date: ${edition.editionDate}\nEdition: ${edition.headline}\n\n${articles.map((article, index) => `${index + 1}. [${article.category}] ${article.title}\nSummary: ${article.summary}\nSource: ${article.sourceName} — ${article.sourceUrl}\nPublished: ${article.publishedAt ?? "today"}${article.imageUrl ? `\nImage: ${article.imageUrl}` : ""}`).join("\n\n")}`;
  } catch { return ""; }
}
function normalizeEdition(edition: Record<string, unknown>, articles: Array<Record<string, unknown>>): NewsEdition {
  return { id: String(edition.id), editionDate: String(edition.edition_date), headline: String(edition.headline), intro: String(edition.intro), refreshedAt: String(edition.refreshed_at), articles: articles.map((article) => ({ id: String(article.id), category: article.category as NewsCategory, title: String(article.title), summary: String(article.summary), sourceName: String(article.source_name), sourceUrl: String(article.source_url), imageUrl: typeof article.image_url === "string" ? article.image_url : null, publishedAt: typeof article.published_at === "string" ? article.published_at : null, rank: Number(article.rank ?? 0) })) };
}
