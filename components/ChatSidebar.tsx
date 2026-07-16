"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Signal } from "./Signal";
import { Plus, X, MessageSquare, Trash2, LogIn, LogOut, User, Search, Sun, Moon, Plug, Edit2, Check } from "lucide-react";
import type { DbChat } from "@/lib/supabase";
import type { AuthUser } from "@/lib/auth";
import { getStoredTheme, toggleTheme, type Theme } from "@/lib/theme";

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
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function handleToggleTheme() {
    setTheme(toggleTheme());
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
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Signal size="sm" />
            <span className="font-display text-base font-bold text-ink">
              NEXO<span className="text-cyan">AI</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1 p-4 pb-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
          >
            <Plus className="h-4 w-4 text-ink-muted" />
            New chat
          </button>

          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
          >
            <Search className="h-4 w-4 text-ink-muted" />
            Search chats
          </button>

          {searchOpen && (
            <div className="px-1 pb-1">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-cyan/50"
              />
            </div>
          )}

          <button
            onClick={handleToggleTheme}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-ink-muted" />
            ) : (
              <Moon className="h-4 w-4 text-ink-muted" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <button
            disabled
            className="flex w-full cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-ink-faint"
          >
            <span className="flex items-center gap-2.5">
              <Plug className="h-4 w-4" />
              Connectors
            </span>
            <span className="rounded-full border border-edge px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-faint">
              Soon
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            Chats
          </p>

          {filteredChats.length === 0 ? (
            <p className="px-1 text-xs text-ink-faint">
              {searchQuery ? "No matching chats." : "No conversations yet."}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition ${
                    activeChatId === chat.id
                      ? "bg-panel shadow-sm"
                      : "hover:bg-panel/60"
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
                        className="w-full bg-transparent text-sm text-ink focus:outline-none"
                      />
                      <button onClick={saveRename} className="text-cyan">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onSelectChat(chat.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
                        <span
                          className={`truncate text-sm ${
                            activeChatId === chat.id ? "text-cyan" : "text-ink"
                          }`}
                        >
                          {chat.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => startEditing(chat)}
                          className="text-ink-faint hover:text-ink"
                          aria-label="Rename chat"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteChat(chat.id)}
                          className="text-ink-faint hover:text-red-500"
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

        <div className="border-t border-edge p-4">
          {user ? (
            <div className="flex items-center justify-between rounded-lg border border-edge bg-panel px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan/15 text-cyan">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="truncate text-xs text-ink-muted">{user.email}</span>
              </div>
              <button
                onClick={onSignOut}
                className="flex-shrink-0 text-ink-faint hover:text-ink"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-cyan/40"
            >
              <LogIn className="h-4 w-4" />
              Sign up / Sign in
            </button>
          )}

          <Link
            href="/pricing"
            className="mt-3 block rounded-lg border border-edge bg-panel p-4 transition hover:border-cyan/40"
          >
            <p className="font-display text-sm font-semibold text-ink">
              Unlock all models
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Plans start at $1.67/month
            </p>
          </Link>
        </div>
      </aside>
    </>
  );
}
