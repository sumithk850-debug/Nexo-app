"use client";

import { useState, useEffect } from "react";
import { Search, X, MessageSquare, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSelectChat: (chatId: string) => void;
}

export function SearchModal({ open, onClose, sessionId, onSelectChat }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; chat_id: string; content: string; chat_title: string; kind: "conversation" | "message" }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || !sessionId) {
      setResults([]);
      return;
    }
    const search = async () => {
      setLoading(true);
      try {
        const { data: chats } = await supabase
          .from("chats")
          .select("id, title, updated_at")
          .eq("session_id", sessionId)
          .order("updated_at", { ascending: false });

        if (!chats || chats.length === 0) {
          setResults([]);
          return;
        }

        const normalizedQuery = query.trim().toLocaleLowerCase();
        const chatIds = chats.map((chat) => chat.id);
        const chatMap = new Map(chats.map((chat) => [chat.id, chat.title]));
        const titleResults = chats
          .filter((chat) => chat.title.toLocaleLowerCase().includes(normalizedQuery))
          .slice(0, 8)
          .map((chat) => ({
            id: `chat:${chat.id}`,
            chat_id: chat.id,
            chat_title: chat.title,
            content: "Conversation title",
            kind: "conversation" as const,
          }));

        const { data: messages } = await supabase
          .from("messages")
          .select("id, chat_id, content")
          .in("chat_id", chatIds)
          .ilike("content", `%${query.trim()}%`)
          .limit(20);

        const messageResults = (messages || []).map((message) => ({
          id: message.id,
          chat_id: message.chat_id,
          content: message.content,
          chat_title: chatMap.get(message.chat_id) || "Untitled conversation",
          kind: "message" as const,
        }));
        setResults([...titleResults, ...messageResults].slice(0, 20));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query, sessionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/60 p-4 pt-[10vh] backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-panel shadow-2xl ring-1 ring-edge"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-edge p-4">
          <Search className="h-5 w-5 text-ink-muted" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search conversations and messages..."
            className="flex-1 bg-transparent text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {loading && <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />}
          <button onClick={onClose} className="rounded-full p-1 text-ink-muted hover:bg-edge hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && query.trim() !== "" && !loading && (
            <p className="p-8 text-center text-sm text-ink-muted">No results found for &quot;{query}&quot;</p>
          )}
          {results.length === 0 && query.trim() === "" && (
            <p className="p-8 text-center text-sm text-ink-muted">Start typing to search your conversations.</p>
          )}
          {results.map(res => (
            <button
              key={res.id}
              onClick={() => {
                onSelectChat(res.chat_id);
                onClose();
              }}
              className="flex w-full flex-col gap-1 rounded-xl p-3 text-left transition hover:bg-edge"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-cyan">
                {res.kind === "conversation" ? <MessageSquare className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                {res.chat_title}
                <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan/80">
                  {res.kind === "conversation" ? "Conversation" : "Message"}
                </span>
              </div>
              <p className={`line-clamp-2 text-sm ${res.kind === "conversation" ? "text-ink-muted" : "text-ink"}`}>
                {res.content}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
