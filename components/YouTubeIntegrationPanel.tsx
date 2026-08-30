"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, Loader2, Search, Youtube } from "lucide-react";
import { authenticatedFetch } from "@/lib/authFetch";

type YouTubeResult = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string | null;
};

interface YouTubeIntegrationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function YouTubeIntegrationPanel({ open, onClose }: YouTubeIntegrationPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/youtube/search?q=${encodeURIComponent(cleanQuery)}&maxResults=6`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not search YouTube.");
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Could not search YouTube.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="YouTube interaction">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-ink shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white" aria-hidden="true">
              <Youtube className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">YouTube</h2>
                <span className="text-[10px] font-medium text-ink-muted">Official source</span>
              </div>
              <p className="text-xs text-ink-muted">Search and explore YouTube content with NEXO.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-ink-muted hover:bg-white/5 hover:text-white">
            Close
          </button>
        </div>

        <div className="p-5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 100))}
                maxLength={100}
                placeholder="Search YouTube..."
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-ink-muted focus:border-cyan"
              />
            </div>
            <button type="submit" disabled={!query.trim() || loading} className="rounded-xl bg-cyan px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </button>
          </form>

          {error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">{error}</p>}

          <div className="mt-5 space-y-3">
            {results.map((result) => (
              <article key={result.videoId} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {result.thumbnailUrl ? (
                  <img src={result.thumbnailUrl} alt="" loading="lazy" className="h-20 w-32 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-32 shrink-0 rounded-lg bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-medium text-white">{result.title}</h3>
                  <p className="mt-1 text-xs text-ink-muted">{result.channelTitle}</p>
                  <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(result.videoId)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan hover:underline">
                    Open on YouTube <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </article>
            ))}

            {!loading && !error && results.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-xs text-ink-muted">
                Search YouTube from NEXO to see results here.
              </div>
            )}
          </div>

          <p className="mt-4 text-[10px] leading-relaxed text-ink-muted">
            YouTube results are retrieved from YouTube and open on YouTube. NEXO does not present itself as YouTube or modify YouTube branding.
          </p>
        </div>
      </div>
    </div>
  );
}
