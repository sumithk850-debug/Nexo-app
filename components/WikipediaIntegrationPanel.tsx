"use client";

import { BookOpen, ExternalLink, Loader2, Search, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { authenticatedFetch } from "@/lib/authFetch";

type Result = {
  pageId: number;
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
};

export function WikipediaIntegrationPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [article, setArticle] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchWikipedia() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setSearched(true);
    setError(null);
    setArticle(null);
    try {
      const response = await authenticatedFetch("/api/wikipedia/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Wikipedia search failed.");
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (cause) {
      setResults([]);
      setError(cause instanceof Error ? cause.message : "Wikipedia is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function openArticle(pageId: number) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch("/api/wikipedia/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.article) throw new Error(data.error ?? "Article unavailable.");
      setArticle(data.article as Result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Article unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-edge bg-void/60 text-ink">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-ink">Wikipedia</h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Available
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">Knowledge / Research · public source, no account connection required.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void searchWikipedia(); }}
          placeholder="Search Wikipedia…"
          aria-label="Search Wikipedia"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-void/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cyan/40"
        />
        <button
          type="button"
          onClick={() => void searchWikipedia()}
          disabled={loading || !query.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan/15 text-cyan transition hover:bg-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Search Wikipedia"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] leading-relaxed text-red-300">{error}</p>}

      {article ? (
        <div className="rounded-xl border border-edge bg-void/40 p-3">
          <button type="button" onClick={() => setArticle(null)} className="mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-ink-muted hover:bg-panel hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to results
          </button>
          <h4 className="break-words text-sm font-semibold text-ink">{article.title}</h4>
          <p className="mt-2 max-h-48 overflow-y-auto text-xs leading-5 text-ink-muted">{article.extract || "No summary is available."}</p>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan/10 px-3 text-[11px] font-semibold text-cyan hover:bg-cyan/20">
            Open Wikipedia <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((result) => (
            <button key={result.pageId} type="button" onClick={() => void openArticle(result.pageId)} className="w-full rounded-xl border border-edge bg-void/40 p-3 text-left transition hover:border-cyan/30 hover:bg-panel/60">
              <p className="break-words text-xs font-semibold text-ink">{result.title}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-faint">{result.extract || "Open this article for a summary."}</p>
            </button>
          ))}
          {!loading && searched && !error && results.length === 0 && (
            <p className="rounded-xl border border-edge bg-void/30 p-4 text-center text-[11px] text-ink-faint">No Wikipedia results found.</p>
          )}
        </div>
      )}
    </div>
  );
}
