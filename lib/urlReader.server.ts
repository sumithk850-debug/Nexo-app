// NEXO AI — Server-only web page reader
// CRITICAL: This file must only ever be imported from app/api/** route handlers.
// It fetches PUBLIC web pages referenced in a user's message and extracts their
// content (title, meta, headings, body text, links, image alt text, lists,
// tables) so every NEXO model can "read" a link the user pastes.
//
// Safety: only http/https, blocks localhost / private / link-local ranges to
// avoid SSRF, enforces a request timeout and a response size cap, and only
// reads text-like content types.

const MAX_URLS = 2; // how many links from a single message we will read
const FETCH_TIMEOUT_MS = 9000;
const MAX_BYTES = 2_500_000; // ~2.5MB cap on downloaded page
const MAX_CONTENT_CHARS = 7000; // main text budget per page
const MAX_LINKS = 40;
const MAX_IMAGES = 20;

const URL_REGEX = /https?:\/\/[^\s<>()"'`]+/gi;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const cleaned = matches
    .map((u) => u.replace(/[.,;:!?)\]}'"]+$/, "")) // trim trailing punctuation
    .filter(Boolean);
  // de-duplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of cleaned) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  // IPv4 private / link-local / loopback ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  // IPv6 loopback / unique-local / link-local
  if (host === "::1") return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  if (host.startsWith("fe80")) return true;

  return false;
}

function isSafeUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;
  if (isPrivateHost(parsed.hostname)) return false;
  return true;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : m
    );
}

function safeFromCodePoint(code: number): string {
  try {
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

// Quote-aware tag matcher: does not terminate a tag on a `>` that appears
// inside a quoted attribute value (e.g. Wikipedia's data-mw='{"...">"}').
const TAG_RE = /<!--[\s\S]*?-->|<[!/?]?[a-zA-Z][^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>/g;

function stripTagsRaw(html: string): string {
  return html.replace(TAG_RE, " ");
}

function collapseWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTags(html: string): string {
  return decodeEntities(stripTagsRaw(html)).replace(/\s+/g, " ").trim();
}

function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
}

function metaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`,
      "i"
    ),
  ];
  for (const p of patterns) {
    const v = firstMatch(html, p);
    if (v) return v;
  }
  return "";
}

interface ExtractedLink {
  text: string;
  href: string;
}

function extractLinks(bodyHtml: string, baseUrl: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) {
    let href = decodeEntities(m[1]).trim();
    const text = stripTags(m[2]);
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }
    try {
      href = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ text: text || href, href });
    if (links.length >= MAX_LINKS) break;
  }
  return links;
}

function extractImageAlts(bodyHtml: string): string[] {
  const alts: string[] = [];
  const seen = new Set<string>();
  const re = /<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) {
    const alt = decodeEntities(m[1]).trim();
    if (!alt || seen.has(alt)) continue;
    seen.add(alt);
    alts.push(alt);
    if (alts.length >= MAX_IMAGES) break;
  }
  return alts;
}

// Convert body HTML into readable, structure-preserving text.
function htmlToStructuredText(bodyHtml: string): string {
  let html = bodyHtml;

  // Drop non-content / noisy regions entirely.
  html = html.replace(
    /<(script|style|noscript|template|svg|canvas|iframe|form|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " "
  );
  html = html.replace(/<!--[\s\S]*?-->/g, " ");

  // Tables -> pipe-separated rows.
  html = html.replace(/<\/(td|th)>/gi, " | ");
  html = html.replace(/<\/tr>/gi, "\n");

  // Headings -> markdown.
  html = html.replace(/<h1\b[^>]*>/gi, "\n\n# ");
  html = html.replace(/<h2\b[^>]*>/gi, "\n\n## ");
  html = html.replace(/<h3\b[^>]*>/gi, "\n\n### ");
  html = html.replace(/<h[4-6]\b[^>]*>/gi, "\n\n#### ");

  // List items and block breaks.
  html = html.replace(/<li\b[^>]*>/gi, "\n- ");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<\/(p|div|section|article|ul|ol|li|h[1-6]|blockquote|pre|tr|table)>/gi, "\n");

  const text = decodeEntities(stripTagsRaw(html));
  return collapseWhitespace(text);
}

export interface PageRead {
  url: string;
  ok: boolean;
  title?: string;
  description?: string;
  content?: string;
  links?: ExtractedLink[];
  images?: string[];
  error?: string;
}

async function readSinglePage(url: string): Promise<PageRead> {
  if (!isSafeUrl(url)) {
    return { url, ok: false, error: "URL is not a readable public http(s) address." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NexoAI-Reader/1.0; +https://nexo.ai)",
        Accept: "text/html,application/xhtml+xml,application/xml,text/plain,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en,si;q=0.8",
      },
    });

    // Guard against redirects to internal hosts.
    if (res.url && !isSafeUrl(res.url)) {
      return { url, ok: false, error: "Redirected to a non-public address." };
    }

    if (!res.ok) {
      return { url, ok: false, error: `Server responded with HTTP ${res.status}.` };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const isTextLike =
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml") ||
      contentType.includes("text/plain") ||
      contentType.includes("application/json") ||
      contentType.includes("application/xml") ||
      contentType.includes("text/xml") ||
      contentType === "";

    if (!isTextLike) {
      return {
        url,
        ok: false,
        error: `Unsupported content type (${contentType || "unknown"}). Only web pages / text can be read.`,
      };
    }

    const raw = await readCapped(res, MAX_BYTES);

    if (contentType.includes("application/json")) {
      const trimmed = raw.trim().slice(0, MAX_CONTENT_CHARS);
      return { url, ok: true, title: url, content: trimmed };
    }

    if (contentType.includes("text/plain")) {
      const trimmed = collapseWhitespace(raw).slice(0, MAX_CONTENT_CHARS);
      return { url, ok: true, title: url, content: trimmed };
    }

    // HTML/XML
    const title =
      firstMatch(raw, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
      metaContent(raw, "og:title") ||
      "";
    const description =
      metaContent(raw, "description") || metaContent(raw, "og:description") || "";

    const bodyMatch = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : raw;

    const content = htmlToStructuredText(bodyHtml).slice(0, MAX_CONTENT_CHARS);
    const links = extractLinks(bodyHtml, res.url || url);
    const images = extractImageAlts(bodyHtml);

    if (!title && !description && !content) {
      return { url, ok: false, error: "No readable content found on the page." };
    }

    return { url, ok: true, title, description, content, links, images };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      url,
      ok: false,
      error: aborted ? "Timed out while loading the page." : "Could not load the page.",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    return text.slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      break;
    }
  }
  out += decoder.decode();
  return out;
}

function renderPageBlock(page: PageRead): string {
  if (!page.ok) {
    return `Web page: ${page.url}\n(Could not read this link: ${page.error})`;
  }
  const parts: string[] = [`Web page: ${page.url}`];
  if (page.title) parts.push(`Title: ${page.title}`);
  if (page.description) parts.push(`Description: ${page.description}`);
  if (page.content) parts.push(`\nContent:\n${page.content}`);
  if (page.links && page.links.length > 0) {
    const list = page.links
      .slice(0, MAX_LINKS)
      .map((l) => `- ${l.text} -> ${l.href}`)
      .join("\n");
    parts.push(`\nLinks on the page (${page.links.length}):\n${list}`);
  }
  if (page.images && page.images.length > 0) {
    parts.push(`\nImages on the page (alt text):\n${page.images.map((a) => `- ${a}`).join("\n")}`);
  }
  return parts.join("\n");
}

// Read up to MAX_URLS public links found in `text` and return a single context
// block ready to inject into the model's system prompt, or "" if there are none.
export async function readUrlsFromText(text: string): Promise<string> {
  const urls = extractUrls(text).slice(0, MAX_URLS);
  if (urls.length === 0) return "";

  const pages = await Promise.all(urls.map((u) => readSinglePage(u)));
  const blocks = pages.map(renderPageBlock);

  return blocks.join("\n\n----------\n\n");
}
