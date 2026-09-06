export type WikipediaChatSource = {
  title: string;
  url: string;
};

const SEARCH_MARKER = /<\/?wikipedia-searching\b[^>]*>/i;
const SEARCH_MARKER_GLOBAL = /<\/?wikipedia-searching\b[^>]*>/gi;
const SOURCES_MARKER = /<wikipedia-sources>([\s\S]*?)<\/wikipedia-sources>/gi;
const SEARCH_PAYLOAD = /\{\s*["']query["']\s*:\s*["'][^"']{1,240}["']\s*\}/gi;

function isSource(value: unknown): value is WikipediaChatSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return typeof source.title === "string" && typeof source.url === "string" && /^https:\/\/en\.wikipedia\.org\/wiki\//.test(source.url);
}

export function hasWikipediaSearchMarker(content: string): boolean {
  return SEARCH_MARKER.test(content);
}

export function parseWikipediaSources(content: string): WikipediaChatSource[] {
  const sources: WikipediaChatSource[] = [];
  for (const match of content.matchAll(SOURCES_MARKER)) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        for (const source of parsed) {
          if (isSource(source) && !sources.some((item) => item.url === source.url)) sources.push(source);
        }
      }
    } catch {
      // An incomplete marker can exist briefly while a response is streaming.
    }
  }
  return sources;
}

export function stripWikipediaChatMarkers(content: string): string {
  return content
    .replace(SEARCH_MARKER_GLOBAL, "")
    .replace(SOURCES_MARKER, "")
    .replace(SEARCH_PAYLOAD, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
