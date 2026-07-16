"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Signal } from "./Signal";
import { Plus, X, MessageSquare, Trash2, LogIn, LogOut, User, Search, Sun, Moon, Plug, Edit2, Check, Code2, Palette, Zap } from "lucide-react";
import type { DbChat } from "@/lib/supabase";
import type { AuthUser } from "@/lib/auth";
import { getStoredTheme, applyTheme, type Theme } from "@/lib/theme";

const NEXO_THEMES: { id: Theme; color: string; name: string }[] = [
  { id: "dark", color: "#0A0E1A", name: "Deep Void" },
  { id: "nebula", color: "#8B5CF6", name: "Cyan Nebula" },
  { id: "emerald", color: "#10B981", name: "Emerald Matrix" },
  { id: "amethyst", color: "#D946EF", name: "Royal Amethyst" },
  { id: "slate", color: "#38BDF8", name: "Midnight Slate" },
];

export function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  open,
  onClose,
  user,
  onOpenAuth,
  onSignOut,
  isCoderMode,
  onToggleCoderMode,
}: {
  chats: DbChat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  isCoderMode: boolean;
  onToggleCoderMode: () => void;
}) {
  const [currentTheme, setCurrentTheme] = useState<Theme>("dark");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [themesOpen, setThemesOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setCurrentTheme(stored);
    applyTheme(stored);
  }, []);

  function handleThemeChange(theme: Theme) {
    setCurrentTheme(theme);
    applyTheme(theme);
  }

  function startEditing(chat: DbChat) {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  }

  function saveRename() {
    if (editingChatId && editTitle.trim()) {
      onRenameChat(editingChatId, editTitle.trim());
      setEditingChatId(null);
    }
  }

  const filteredChats = searchQuery.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chats;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-edge bg-panel-raised transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-edge px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="absolute inset-0 blur-lg bg-cyan/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Signal size="sm" />
            </div>
            <span className="font-display text-lg font-black tracking-tight text-ink">
              NEXO<span className="text-cyan">AI</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink md:hidden transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5 p-4 pb-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-ink transition-all hover:bg-panel hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 text-cyan" />
            New Session
          </button>

          <button
            onClick={onToggleCoderMode}
            className={`group relative flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 ${
              isCoderMode 
                ? "bg-cyan/10 text-cyan shadow-[0_0_20px_rgba(0,229,255,0.1)] border border-cyan/20" 
                : "text-ink hover:bg-panel hover:scale-[1.02]"
            }`}
          >
            <span className="flex items-center gap-3">
              <Code2 className={`h-4 w-4 transition-transform duration-500 ${isCoderMode ? 'rotate-12' : ''}`} />
              Nexo Coder Agent
            </span>
            {isCoderMode ? (
              <span className="flex h-2 w-2 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)] animate-pulse"></span>
            ) : (
              <Zap className="h-3 w-3 text-ink-faint group-hover:text-cyan transition-colors" />
            )}
          </button>

          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-ink transition-all hover:bg-panel"
          >
            <Search className="h-4 w-4 text-ink-muted" />
            Search History
          </button>

          {searchOpen && (
            <div className="px-1 pb-1 animate-fade-up">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find a chat…"
                className="w-full rounded-xl border border-edge bg-panel px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-cyan/50 transition-all"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => setThemesOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-ink transition-all hover:bg-panel"
            >
              <Palette className="h-4 w-4 text-ink-muted" />
              Nexo Themes
            </button>
            
            {themesOpen && (
              <div className="mt-3 flex flex-wrap gap-2.5 px-4 pb-3 animate-fade-up">
                {NEXO_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    title={t.name}
                    className={`h-7 w-7 rounded-full border-2 transition-all duration-300 ${
                      currentTheme === t.id ? "border-cyan scale-125 shadow-[0_0_10px_rgba(0,229,255,0.4)]" : "border-edge hover:scale-110"
                    }`}
                    style={{ backgroundColor: t.color }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <p className="mb-3 px-2 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-ink-faint/60">
            Recent Protocols
          </p>

          {filteredChats.length === 0 ? (
            <p className="px-2 text-[11px] font-medium text-ink-faint italic">
              {searchQuery ? "No matching records found." : "Your nexus is empty."}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                    activeChatId === chat.id
                      ? "bg-panel shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-edge"
                      : "hover:bg-panel/40"
                  }`}
                >
                  {editingChatId === chat.id ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRename()}
                        onBlur={saveRename}
                        className="w-full bg-transparent text-sm font-bold text-ink focus:outline-none"
                      />
                      <button onClick={saveRename} className="text-cyan">
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onSelectChat(chat.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <MessageSquare className={`h-4 w-4 flex-shrink-0 transition-colors ${activeChatId === chat.id ? 'text-cyan' : 'text-ink-faint'}`} />
                        <span
                          className={`truncate text-[13px] font-bold tracking-tight transition-colors ${
                            activeChatId === chat.id ? "text-cyan" : "text-ink/80"
                          }`}
                        >
                          {chat.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEditing(chat)}
                          className="text-ink-faint hover:text-cyan transition-colors"
                          aria-label="Rename chat"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteChat(chat.id)}
                          className="text-ink-faint hover:text-red-500 transition-colors"
                          aria-label="Delete chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-edge p-5 space-y-4">
          {user ? (
            <div className="flex items-center justify-between rounded-2xl border border-edge bg-panel/50 backdrop-blur-md px-4 py-3 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan/10 text-cyan border border-cyan/20">
                  <User className="h-4 w-4" />
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-green-500"></div>
                </div>
                <span className="truncate text-xs font-bold text-ink-muted">{user.email?.split('@')[0]}</span>
              </div>
              <button
                onClick={onSignOut}
                className="flex-shrink-0 text-ink-faint hover:text-red-500 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-panel px-4 py-3 text-sm font-black uppercase tracking-widest text-ink transition-all hover:border-cyan/40 hover:shadow-lg active:scale-95"
            >
              <LogIn className="h-4 w-4" />
              Initialize
            </button>
          )}

          <Link
            href="/pricing"
            className="group block rounded-2xl border border-edge bg-gradient-to-br from-panel to-void p-5 transition-all hover:border-cyan/40 hover:shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
              <Zap className="h-12 w-12 text-cyan" />
            </div>
            <p className="font-display text-sm font-black uppercase tracking-tight text-ink group-hover:text-cyan transition-colors">
              Ascend to Pro
            </p>
            <p className="mt-1 text-[11px] font-bold text-ink-muted leading-relaxed">
              Unlock the full potential of NEXO AI architecture.
            </p>
          </Link>
        </div>
      </aside>
    </>
  );
}
