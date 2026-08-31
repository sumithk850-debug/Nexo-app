"use client";

import { ExternalLink, Loader2, Search, BookOpen, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authFetch";

type Result = { pageId: number; title: string; extract: string; url: string; thumbnail?: string };

type Props = { userId?: string };

export function WikipediaIntegrationPanel({ userId }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [article, setArticle] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingStatus(true);
    void authenticatedFetch(`/api/integrations/wikipedia?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Could not load Wikipedia status.");
        if (!cancelled) setEnabled(data.enabled !== false);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Wikipedia integration status.");
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggleWikipedia() {
    if (!userId || saving || loadingStatus) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      const response = await authenticatedFetch("/api/integrations/wikipedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, enabled: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not save Wikipedia preference.");
      setEnabled(data.enabled === true);
      if (!data.enabled) {
        setResults([]);
        setArticle(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Wikipedia preference.");
    } finally {
      setSaving(false);
    }
  }

  async function searchWikipedia() {
    const q = query.trim();
    if (!q || !userId || !enabled) return;
    setLoading(true);
    setError(null);
    setArticle(null);
    try {
      const response = await authenticatedFetch("/api/wikipedia/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, query: q }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Wikipedia search failed.");
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : "Wikipedia is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function openArticle(pageId: number) {
    if (!userId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch("/api/wikipedia/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pageId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.article) throw new Error(data.error ?? "Article unavailable.");
      setArticle(data.article);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Article unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10">
          <BookOpen className="h-5 w-5 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-ink">Wikipedia</h3>
              <p className="text-xs text-ink-muted">Knowledge / Research</p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-ink-faint/10 text-ink-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-400" : "bg-current"}`} />
              {enabled ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-edge pt-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Power className="h-3.5 w-3.5" />
          Allow NEXO to use Wikipedia
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? "Turn Wikipedia off" : "Turn Wikipedia on"}
          onClick={() => void toggleWikipedia()}
          disabled={!userId || saving || loadingStatus}
          className={`relative h-7 w-12 rounded-full p-[3px] shadow-inner transition-colors ${enabled ? "bg-violet-500" : "bg-ink-faint/30"} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <span className={`block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${enabled ? "translate-x-[22px]" : "translate-x-0"}`} />
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-faint">
        When ON, relevant knowledge questions may use Wikipedia through NEXO's research orchestration. Wikipedia text is treated as untrusted external data and never as system instructions.
      </p>

      {enabled && (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void searchWikipedia(); }}
              placeholder="Search Wikipedia…"
              className="min-w-0 flex-1 rounded-xl border border-edge bg-void/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-violet-400/40"
            />
            <button
              onClick={() => void searchWikipedia()}
              disabled={loading || !query.trim() || !userId}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300 disabled:opacity-40"
              aria-label="Search Wikipedia"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
          {!loading && !error && query.trim() && results.length === 0 && !article && <p className="rounded-xl border border-edge bg-void/40 p-4 text-center text-xs text-ink-faint">No Wikipedia results found.</p>}
          {article ? (
            <div className="rounded-2xl border border-edge bg-panel/60 p-4">
              <h4 className="text-base font-semibold text-ink">{article.title}</h4>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{article.extract || "No summary is available."}</p>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-panel px-3 text-xs font-semibold text-ink hover:bg-void">
                Open Wikipedia <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <button key={result.pageId} onClick={() => void openArticle(result.pageId)} className="w-full rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:bg-panel">
                  <p className="font-semibold text-ink">{result.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{result.extract}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
