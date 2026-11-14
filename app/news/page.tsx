"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, ExternalLink, Loader2, Newspaper, RefreshCw, Sparkles } from "lucide-react";
import { authenticatedFetch } from "@/lib/authFetch";

type Article = {
  id: string;
  category: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: string | null;
};
type Edition = { editionDate: string; headline: string; intro: string; refreshedAt: string; articles: Article[] };
const categoryOrder = ["World", "Technology", "Science", "Business", "Culture", "Climate"];
const categoryColors: Record<string, string> = {
  World: "border-blue-300/20 bg-blue-300/10 text-blue-200",
  Technology: "border-cyan/25 bg-cyan/10 text-cyan",
  Science: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  Business: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  Culture: "border-pink-300/20 bg-pink-300/10 text-pink-200",
  Climate: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}
function formatTime(value: string | null) {
  if (!value) return "Today";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function DailyNewsPage() {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function loadNews() {
    setError("");
    try {
      const response = await authenticatedFetch("/api/news", { cache: "no-store" });
      const data = await response.json() as Edition & { error?: string };
      if (!response.ok) throw new Error(data.error || "Today's edition is unavailable.");
      setEdition(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Today's edition is unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { void loadNews(); }, []);
  const grouped = useMemo(() => categoryOrder.map((category) => ({ category, articles: edition?.articles.filter((article) => article.category === category) ?? [] })).filter((group) => group.articles.length > 0), [edition]);
  const lead = edition?.articles[0];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07121b] text-white selection:bg-cyan/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(30,135,160,0.22),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(70,54,145,0.18),transparent_28%)]" />
      <header className="relative z-10 border-b border-white/10 bg-[#07121b]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 transition hover:text-cyan"><ArrowLeft className="h-4 w-4" />Back to Kyvorix AI</Link>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.22em] text-white/45"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />Daily edition</div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-16 lg:px-10 lg:pb-24 lg:pt-24">
        <div className="max-w-4xl">
          <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-cyan"><Sparkles className="h-4 w-4" />Kyvorix editorial intelligence</p>
          <h1 className="max-w-4xl font-display text-5xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-7xl lg:text-8xl">Daily News<br /><span className="bg-gradient-to-r from-cyan via-sky-300 to-violet-300 bg-clip-text text-transparent">Summarization</span></h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65 sm:text-xl">by <span className="font-semibold text-white">Kyvorix AI</span>. A calmer way to understand what changed in the world today — across technology, science, business, culture, climate and global affairs.</p>
          <div className="mt-9 flex flex-wrap gap-3 text-xs text-white/55"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"><CalendarDays className="h-3.5 w-3.5 text-cyan" />{edition ? formatDate(edition.editionDate) : "Fresh every day"}</span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"><Newspaper className="h-3.5 w-3.5 text-violet-300" />{edition ? `${edition.articles.length} stories in this edition` : "Trusted source briefing"}</span></div>
        </div>
        <a href="#today" className="mt-12 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-sky-400 px-6 py-3.5 text-sm font-bold text-[#041018] shadow-[0_10px_35px_rgba(34,211,238,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_45px_rgba(34,211,238,0.32)]">Open and watch today&apos;s news <ArrowUpRight className="h-4 w-4" /></a>
      </section>

      <section id="today" className="relative z-10 mx-auto max-w-7xl px-5 pb-24 lg:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan">Today&apos;s signal</p><h2 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">What matters today</h2></div><button onClick={() => { setRefreshing(true); void loadNews(); }} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-cyan/40 hover:text-cyan disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />Refresh edition</button></div>
        {loading ? <div className="flex min-h-64 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]"><Loader2 className="h-6 w-6 animate-spin text-cyan" /></div> : error ? <div className="rounded-3xl border border-rose-300/20 bg-rose-300/5 p-8 text-center"><p className="font-semibold text-rose-200">{error}</p><button onClick={() => { setLoading(true); void loadNews(); }} className="mt-4 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white">Try again</button></div> : lead ? <>
          <article className="group relative mb-14 grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] lg:grid-cols-[1.2fr_0.8fr]"><div className="relative min-h-[300px] overflow-hidden bg-gradient-to-br from-cyan/20 via-slate-900 to-violet-900/30 lg:min-h-[420px]">{lead.imageUrl && <><span className="absolute inset-0 bg-gradient-to-t from-[#07121b] via-transparent to-transparent" /><img src={lead.imageUrl} alt="" className="h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-105" /></>}</div><div className="flex flex-col justify-center p-7 sm:p-10"><span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${categoryColors[lead.category] ?? categoryColors.World}`}>{lead.category} · lead story</span><h3 className="mt-5 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{lead.title}</h3><p className="mt-5 text-base leading-7 text-white/65">{lead.summary}</p><div className="mt-7 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/45"><span>{lead.sourceName} · {formatTime(lead.publishedAt)}</span><a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cyan hover:text-white">Read source <ExternalLink className="h-3 w-3" /></a></div></div></article>
          <div className="space-y-16">{grouped.map((group) => <section key={group.category}><div className="mb-5 flex items-center gap-3"><h3 className="font-display text-2xl font-bold text-white">{group.category}</h3><span className="h-px flex-1 bg-white/10" /><span className="text-xs font-mono text-white/35">{group.articles.length} stories</span></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{group.articles.map((article) => <article key={article.id} className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] transition duration-300 hover:-translate-y-1 hover:border-cyan/30 hover:bg-white/[0.07]"><div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950">{article.imageUrl && <img src={article.imageUrl} alt="" className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105" />}<span className={`absolute left-4 top-4 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest backdrop-blur-md ${categoryColors[article.category] ?? categoryColors.World}`}>{article.category}</span></div><div className="flex flex-1 flex-col p-5"><h4 className="font-display text-xl font-bold leading-snug text-white">{article.title}</h4><p className="mt-3 line-clamp-4 text-sm leading-6 text-white/60">{article.summary}</p><div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 pt-4 mt-5 text-[11px] text-white/40"><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatTime(article.publishedAt)}</span><a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cyan hover:text-white">Source <ExternalLink className="h-3 w-3" /></a></div></div></article>)}</div></section>)}</div>
        </> : <div className="rounded-3xl border border-white/10 p-8 text-white/60">No stories are available yet.</div>}
      </section>
      <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-xs text-white/35">Kyvorix AI editorial desk · Summaries are generated from linked source reporting. Always open the source for the complete story.</footer>
    </main>
  );
}
