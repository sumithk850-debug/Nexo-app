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

const FEEDS: Feed[] = [
  { category: "World", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { category: "Technology", name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { category: "Science", name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml" },
  { category: "Business", name: "The Guardian Business", url: "https://www.theguardian.com/business/rss" },
  { category: "Culture", name: "The Guardian Culture", url: "https://www.theguardian.com/culture/rss" },
  { category: "Climate", name: "The Guardian Environment", url: "https://www.theguardian.com/environment/climate-crisis/rss" },
];
const MAX_ARTICLES = 24;
const USER_AGENT = "KyvorixAI-DailyNews/1.0 (+https://nexo-app-delta.vercel.app)";

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">" ).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}
function attr(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}
function parseFeed(xml: string, feed: Feed): RawArticle[] {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 8).map((match) => {
    const block = match[1];
    const title = tag(block, "title");
    const sourceUrl = tag(block, "link") || tag(block, "guid");
    const description = tag(block, "description") || tag(block, "content:encoded");
    const imageMatch = block.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i);
    const published = tag(block, "pubDate") || tag(block, "dc:date");
    if (!title || !sourceUrl) return null;
    return {
      category: feed.category,
      title: title.slice(0, 240),
      description: description.slice(0, 2_000),
      sourceName: feed.name,
      sourceUrl,
      imageUrl: imageMatch?.[1] ?? null,
      publishedAt: published ? new Date(published).toISOString() : null,
      guid: tag(block, "guid") || sourceUrl,
    } satisfies RawArticle;
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
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://nexo-app-delta.vercel.app", "X-Title": "Kyvorix AI Daily News" },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        temperature: 0.2,
        max_tokens: 120,
        messages: [
          { role: "system", content: "You are Kyvorix AI's editorial summarizer. Summarize the supplied news item in 2 clear sentences for a general reader. Do not invent facts, do not add a headline, and mention uncertainty when the source description is incomplete." },
          { role: "user", content: `Category: ${article.category}\nTitle: ${article.title}\nSource description: ${article.description}` },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return fallbackSummary(article);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? `Kyvorix AI summary: ${content.slice(0, 700)}` : fallbackSummary(article);
  } catch {
    return fallbackSummary(article);
  }
}
async function collectArticles(): Promise<RawArticle[]> {
  const responses = await Promise.allSettled(FEEDS.map(async (feed) => {
    const response = await fetch(feed.url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
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
  }).slice(0, MAX_ARTICLES);
}
function utcDate(): string { return new Date().toISOString().slice(0, 10); }

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
  const summarized = await Promise.all(raw.map(async (article, index) => ({ ...article, summary: await summarize(article), rank: index })));
  const { data: edition, error: editionError } = await admin.from("news_editions").upsert({ edition_date: editionDate, status: "published", headline: "Daily News Summarization by Kyvorix AI", intro: "A clear, calm briefing of the stories shaping the world today — gathered from trusted publications and distilled by Kyvorix AI.", generated_at: new Date().toISOString(), refreshed_at: new Date().toISOString() }, { onConflict: "edition_date" }).select("id, edition_date, headline, intro, refreshed_at").single();
  if (editionError || !edition) throw new Error("Could not save today's news edition.");
  await admin.from("news_articles").delete().eq("edition_id", edition.id);
  const { error: articleError } = await admin.from("news_articles").insert(summarized.map(({ category, title, summary, sourceName, sourceUrl, imageUrl, publishedAt, guid, rank }) => ({ edition_id: edition.id, category, title, summary, source_name: sourceName, source_url: sourceUrl, image_url: imageUrl, published_at: publishedAt, source_guid: guid, rank })));
  if (articleError) throw new Error("Could not save today's news articles.");
  return normalizeEdition(edition, summarized.map((item, index) => ({ id: `${edition.id}-${index}`, category: item.category, title: item.title, summary: item.summary, source_name: item.sourceName, source_url: item.sourceUrl, image_url: item.imageUrl, published_at: item.publishedAt, rank: item.rank })));
}
function normalizeEdition(edition: Record<string, unknown>, articles: Array<Record<string, unknown>>): NewsEdition {
  return { id: String(edition.id), editionDate: String(edition.edition_date), headline: String(edition.headline), intro: String(edition.intro), refreshedAt: String(edition.refreshed_at), articles: articles.map((article) => ({ id: String(article.id), category: article.category as NewsCategory, title: String(article.title), summary: String(article.summary), sourceName: String(article.source_name), sourceUrl: String(article.source_url), imageUrl: typeof article.image_url === "string" ? article.image_url : null, publishedAt: typeof article.published_at === "string" ? article.published_at : null, rank: Number(article.rank ?? 0) })) };
}
