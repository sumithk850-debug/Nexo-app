"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Plus, X, MessageSquare, Trash2, LogIn, LogOut, User, Search, Sun, Moon, Edit2, Check, Code2, Palette, Zap, Atom, PenTool, BarChart2, Sparkles, Bookmark, FolderOpen, FolderPlus, Folder, ChevronDown, ChevronRight } from "lucide-react";
import type { DbChat } from "@/lib/supabase";
import type { AuthUser } from "@/lib/auth";
import { getStoredTheme, applyTheme, toggleTheme, type Theme } from "@/lib/theme";

const NEXO_THEMES: { id: Theme; color: string; name: string }[] = [
  { id: "dark", color: "#0A0E1A", name: "Deep Void" },
  { id: "nebula", color: "#8B5CF6", name: "Cyan Nebula" },
  { id: "emerald", color: "#10B981", name: "Emerald Matrix" },
  { id: "amethyst", color: "#D946EF", name: "Royal Amethyst" },
  { id: "slate", color: "#38BDF8", name: "Midnight Slate" },
];

export const PERSONAS = [
  { id: "general", name: "General AI", icon: Sparkles },
  { id: "react", name: "React Expert ⚛️", icon: Atom },
  { id: "copywriter", name: "Copywriter ✍️", icon: PenTool },
  { id: "analyst", name: "Data Analyst 📊", icon: BarChart2 },
];

const TEMPLATES = [
  { id: "review", name: "Code Review", prompt: "Please review the following code and suggest improvements:\n\n```\n\n```" },
  { id: "explain", name: "Explain Code", prompt: "Can you explain how this code works in simple terms?\n\n```\n\n```" },
  { id: "refactor", name: "Refactor", prompt: "Please refactor this code for better performance and readability:\n\n```\n\n```" },
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
  onGlobalSearch,
  activePersona,
  onSelectPersona,
  onInsertTemplate,
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
  onGlobalSearch: () => void;
  activePersona: string;
  onSelectPersona: (id: string) => void;
  onInsertTemplate: (prompt: string) => void;
}) {
  const [currentTheme, setCurrentTheme] = useState<Theme>("dark");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [themesOpen, setThemesOpen] = useState(false);
  const [personasOpen, setPersonasOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Chat Folder Organization state
  const [folderView, setFolderView] = useState(true);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [customFoldersOpen, setCustomFoldersOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Load folder assignments from localStorage
  const [chatFolders, setChatFolders] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("nexo_chat_folders") || "{}");
    } catch {
      return {};
    }
  });

  function saveFolderAssignment(chatId: string, folder: string) {
    setChatFolders((prev) => {
      const updated = { ...prev, [chatId]: folder };
      localStorage.setItem("nexo_chat_folders", JSON.stringify(updated));
      return updated;
    });
  }

  function removeFolderAssignment(chatId: string) {
    setChatFolders((prev) => {
      const { [chatId]: _, ...rest } = prev;
      localStorage.setItem("nexo_chat_folders", JSON.stringify(rest));
      return rest;
    });
  }

  function toggleFolderCollapse(folderName: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  }

  function createCustomFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setNewFolderName("");
    // Create a folder marker — chats can be assigned to it
    const existing = Object.values(chatFolders);
    if (existing.includes(name)) return;
  }

  // Categorize chats into auto folders
  function getAutoFolder(chat: DbChat): string {
    const now = new Date();
    const chatDate = new Date(chat.updated_at || chat.created_at);
    const diffMs = now.getTime() - chatDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 1) return "Today";
    if (diffDays < 2) return "Yesterday";
    if (diffDays < 7) return "This Week";
    return "Older";
  }

  // Group chats by folder
  function getGroupedChats(): Record<string, DbChat[]> {
    if (!folderView) return { "": chats };

    const groups: Record<string, DbChat[]> = {};
    const autoFolders = ["Today", "Yesterday", "This Week", "Older"];
    const customFolders = [...new Set(Object.values(chatFolders).filter((f) => !autoFolders.includes(f)))];

    // Custom folders first
    for (const folder of customFolders) {
      const folderChats = chats.filter((c) => chatFolders[c.id] === folder);
      if (folderChats.length > 0) groups[folder] = folderChats;
    }

    // Auto folders
    for (const folder of autoFolders) {
      const folderChats = chats.filter((c) => {
        // Only include if not in a custom folder
        if (chatFolders[c.id] && !autoFolders.includes(chatFolders[c.id])) return false;
        return getAutoFolder(c) === folder;
      });
      if (folderChats.length > 0) groups[folder] = folderChats;
    }

    return groups;
  }

  const groupedChats = getGroupedChats();

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

  const activePersonaObj = PERSONAS.find(p => p.id === activePersona) || PERSONAS[0];

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
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-edge px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan text-panel font-bold shadow-md">
              Nx
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-ink">
              Nexo
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleThemeChange(currentTheme === "light" ? "dark" : "light")}
              className="text-ink-muted hover:text-ink transition-colors"
              aria-label="Toggle theme"
            >
              {currentTheme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
            onClick={onToggleCoderMode}
            className={`group relative flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isCoderMode 
                ? "bg-cyan/10 text-cyan border border-cyan/20" 
                : "text-ink hover:bg-panel"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Code2 className="h-4 w-4" />
              Nexo Coder Agent
            </span>
            {isCoderMode ? (
              <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse"></span>
            ) : (
              <Zap className="h-3 w-3 text-ink-faint group-hover:text-cyan" />
            )}
          </button>

          <button
            onClick={onGlobalSearch}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
          >
            <Search className="h-4 w-4 text-ink-muted" />
            Global Search
          </button>

          <div className="pt-2 border-t border-edge space-y-1 mt-2">
            <button
              onClick={() => setPersonasOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
            >
              <div className="flex items-center gap-2.5">
                <activePersonaObj.icon className="h-4 w-4 text-cyan" />
                <span>Persona: {activePersonaObj.name.split(' ')[0]}</span>
              </div>
            </button>
            {personasOpen && (
              <div className="mt-1 flex flex-col gap-1 px-3 pb-2">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelectPersona(p.id); setPersonasOpen(false); }}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition ${
                      activePersona === p.id ? "bg-cyan/10 text-cyan" : "text-ink-muted hover:bg-edge"
                    }`}
                  >
                    <p.icon className="h-3.5 w-3.5" />
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setTemplatesOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
            >
              <Bookmark className="h-4 w-4 text-ink-muted" />
              Prompt Library
            </button>
            {templatesOpen && (
              <div className="mt-1 flex flex-col gap-1 px-3 pb-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onInsertTemplate(t.prompt); setTemplatesOpen(false); }}
                    className="text-left rounded-lg px-2 py-1.5 text-xs text-ink-muted transition hover:bg-edge hover:text-ink"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
          {chats.length === 0 ? (
            <p className="px-1 text-xs text-ink-faint">
              No conversations yet.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Folder header with toggle */}
              <div className="flex items-center justify-between px-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                  {folderView ? "Chats by Folder" : "Recent Chats"}
                </p>
                <button
                  onClick={() => setFolderView(!folderView)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-faint transition hover:bg-panel hover:text-ink"
                  title={folderView ? "Switch to flat view" : "Switch to folder view"}
                >
                  {folderView ? <ChevronDown className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                  {folderView ? "Flat" : "Folders"}
                </button>
              </div>

              {folderView ? (
                /* Folder-grouped view */
                Object.entries(groupedChats).map(([folderName, folderChats]) => {
                  const isCollapsed = collapsedFolders.has(folderName);
                  const autoFolders = ["Today", "Yesterday", "This Week", "Older"];
                  const isAuto = autoFolders.includes(folderName);

                  return (
                    <div key={folderName} className="space-y-1">
                      {/* Folder header */}
                      <button
                        onClick={() => toggleFolderCollapse(folderName)}
                        className="flex w-full items-center gap-1.5 px-1 py-1 text-left text-[10px] font-medium text-ink-muted transition hover:text-ink"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {isAuto ? (
                          <FolderOpen className="h-3 w-3 text-cyan/60" />
                        ) : (
                          <Folder className="h-3 w-3 text-amber-400/60" />
                        )}
                        <span className="uppercase tracking-wider">{folderName}</span>
                        <span className="text-ink-faint">({folderChats.length})</span>
                      </button>

                      {/* Folder chats */}
                      {!isCollapsed && (
                        <div className="flex flex-col gap-0.5 pl-2">
                          {folderChats.map((chat) => (
                            <div
                              key={chat.id}
                              className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition ${
                                activeChatId === chat.id
                                  ? "bg-panel shadow-sm border border-edge"
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
                                    <MessageSquare className={`h-3.5 w-3.5 flex-shrink-0 ${activeChatId === chat.id ? 'text-cyan' : 'text-ink-faint'}`} />
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
                                    {/* Move to folder button */}
                                    <div className="relative">
                                      <select
                                        value={chatFolders[chat.id] || ""}
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            saveFolderAssignment(chat.id, e.target.value);
                                          } else {
                                            removeFolderAssignment(chat.id);
                                          }
                                        }}
                                        className="hidden group-hover:block rounded border border-edge bg-panel px-1 py-0.5 text-[10px] text-ink-faint focus:outline-none"
                                        title="Move to folder"
                                      >
                                        <option value="">Auto</option>
                                        <option value="Today">Today</option>
                                        <option value="Yesterday">Yesterday</option>
                                        <option value="This Week">This Week</option>
                                        <option value="Older">Older</option>
                                        {[...new Set(Object.values(chatFolders).filter((f) => !autoFolders.includes(f)))].map((f) => (
                                          <option key={f} value={f}>{f}</option>
                                        ))}
                                      </select>
                                    </div>
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
                  );
                })
              ) : (
                /* Flat view (original) */
                <div className="flex flex-col gap-1">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition ${
                        activeChatId === chat.id
                          ? "bg-panel shadow-sm border border-edge"
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
                            <MessageSquare className={`h-3.5 w-3.5 flex-shrink-0 ${activeChatId === chat.id ? 'text-cyan' : 'text-ink-faint'}`} />
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
          )}
        </div>

        <div className="border-t border-edge p-4 space-y-3">
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
        </div>
      </aside>
    </>
  );
}
