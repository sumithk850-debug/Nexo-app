"use client";

import { useState, useEffect } from "react";
import { Search, X, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSelectChat: (chatId: string) => void;
}

export function SearchModal({ open, onClose, sessionId, onSelectChat }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; chat_id: string; content: string; chat_title?: string }[]>([]);
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
          .select("id, title")
          .eq("session_id", sessionId);
          
        if (!chats || chats.length === 0) return;
        
        const chatIds = chats.map(c => c.id);
        const chatMap = new Map(chats.map(c => [c.id, c.title]));

        const { data: messages } = await supabase
          .from("messages")
          .select("id, chat_id, content")
          .in("chat_id", chatIds)
          .ilike("content", `%${query}%`)
          .limit(20);

        if (messages) {
          setResults(messages.map(m => ({
            ...m,
            chat_title: chatMap.get(m.chat_id) || "Unknown Chat"
          })));
        }
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
            placeholder="Search across all chats..."
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
                <MessageSquare className="h-3.5 w-3.5" />
                {res.chat_title}
              </div>
              <p className="line-clamp-2 text-sm text-ink">
                {res.content}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
