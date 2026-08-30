import "server-only";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3/search";
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 10;

export type YouTubeSearchItem = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string | null;
};

export class YouTubeConfigError extends Error {
  constructor() {
    super("YouTube search is not configured on the server.");
    this.name = "YouTubeConfigError";
  }
}

export class YouTubeQuotaError extends Error {
  constructor() {
    super("YouTube search quota is currently unavailable.");
    this.name = "YouTubeQuotaError";
  }
}

export async function searchYouTube(query: string, requestedMaxResults = 6): Promise<YouTubeSearchItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new YouTubeConfigError();

  const q = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (!q) return [];

  const maxResults = Math.min(Math.max(Math.floor(requestedMaxResults) || 6, 1), MAX_RESULTS);
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q,
    maxResults: String(maxResults),
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}?${params.toString()}`, {
    method: "GET",
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });

  if (response.status === 403) throw new YouTubeQuotaError();
  if (!response.ok) throw new Error("YouTube search request failed.");

  const data = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  return (data.items ?? [])
    .map((item) => ({
      videoId: item.id?.videoId ?? "",
      title: item.snippet?.title ?? "Untitled video",
      description: item.snippet?.description ?? "",
      channelId: item.snippet?.channelId ?? "",
      channelTitle: item.snippet?.channelTitle ?? "Unknown channel",
      publishedAt: item.snippet?.publishedAt ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    }))
    .filter((item) => item.videoId.length > 0);
}
