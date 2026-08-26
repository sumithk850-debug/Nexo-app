"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircle, MessageSquare, Search, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/authFetch";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

type SearchResult = {
  id: string;
  chat_id: string;
  content: string;
  chat_title: string;
  kind: "conversation" | "message";
};

export function SearchModal({ open, onClose, onSelectChat }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }
    if (trimmed.length < 2) {
      setResults([]);
      setError("Type at least 2 characters to search.");
      return;
    }

    const controller = new AbortController();
    const search = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authenticatedFetch(`/api/chats/search?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          setResults([]);
          setError(data.error ?? "Could not search conversations.");
          return;
        }
        setResults(data.results ?? []);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") {
          setResults([]);
          setError("Could not search conversations.");
        }
      } finally {
        setLoading(false);
      }
    };

    const debounce = window.setTimeout(() => void search(), 300);
    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/60 p-4 pt-[10vh] backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-panel shadow-2xl ring-1 ring-edge" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-edge p-4">
          <Search className="h-5 w-5 text-ink-muted" />
          <input autoFocus type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your conversations and messages..." className="flex-1 bg-transparent text-ink placeholder:text-ink-faint focus:outline-none" />
          {loading && <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />}
          <button onClick={onClose} className="rounded-full p-1 text-ink-muted hover:bg-edge hover:text-ink" aria-label="Close search"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {error && <p className="p-5 text-center text-sm text-amber-200">{error}</p>}
          {!error && results.length === 0 && query.trim() !== "" && !loading && <p className="p-8 text-center text-sm text-ink-muted">No results found for &quot;{query}&quot;</p>}
          {!error && results.length === 0 && query.trim() === "" && <p className="p-8 text-center text-sm text-ink-muted">Start typing to search your conversations.</p>}
          {results.map((result) => (
            <button key={result.id} onClick={() => { onSelectChat(result.chat_id); onClose(); }} className="flex w-full flex-col gap-1 rounded-xl p-3 text-left transition hover:bg-edge">
              <div className="flex items-center gap-2 text-xs font-medium text-cyan">
                {result.kind === "conversation" ? <MessageSquare className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                {result.chat_title}
                <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan/80">{result.kind === "conversation" ? "Conversation" : "Message"}</span>
              </div>
              <p className={`line-clamp-2 text-sm ${result.kind === "conversation" ? "text-ink-muted" : "text-ink"}`}>{result.content}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
