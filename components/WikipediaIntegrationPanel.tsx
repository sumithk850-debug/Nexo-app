"use client";

import { ExternalLink, Loader2, Search, BookOpen } from "lucide-react";
import { useState } from "react";

type Result = { pageId: number; title: string; extract: string; url: string; thumbnail?: string };

export function WikipediaIntegrationPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [article, setArticle] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setError(null); setArticle(null);
    try {
      const response = await fetch("/api/wikipedia/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Wikipedia search failed.");
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) { setResults([]); setError(e instanceof Error ? e.message : "Wikipedia is unavailable."); }
    finally { setLoading(false); }
  }

  async function openArticle(pageId: number) {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/wikipedia/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.article) throw new Error(data.error ?? "Article unavailable.");
      setArticle(data.article);
    } catch (e) { setError(e instanceof Error ? e.message : "Article unavailable."); }
    finally { setLoading(false); }
  }

  return <div className="w-full space-y-4">
    <div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06]"><BookOpen className="h-5 w-5 text-violet-300" /></div><div><h3 className="font-semibold text-white">Wikipedia</h3><p className="text-xs text-white/50">Knowledge / Research · Available</p></div></div>
    <div className="flex gap-2"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void search(); }} placeholder="Search Wikipedia…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm outline-none placeholder:text-white/35 focus:border-violet-400/40" /><button onClick={() => void search()} disabled={loading || !query.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-600 disabled:opacity-40" aria-label="Search Wikipedia">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>
    {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
    {!loading && !error && query.trim() && results.length === 0 && !article && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-white/50">No Wikipedia results found.</p>}
    {article ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h4 className="text-base font-semibold text-white">{article.title}</h4><p className="mt-2 text-sm leading-6 text-white/70">{article.extract || "No summary is available."}</p><a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15">Open Wikipedia <ExternalLink className="h-3.5 w-3.5" /></a></div> : <div className="space-y-2">{results.map(result => <button key={result.pageId} onClick={() => void openArticle(result.pageId)} className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.07]"><p className="font-semibold text-white">{result.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55">{result.extract}</p></button>)}</div>}
  </div>;
}
