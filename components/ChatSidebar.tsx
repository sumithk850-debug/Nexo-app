"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Plus, X, MessageSquare, Trash2, LogIn, LogOut, User, Search, Sun, Moon, Edit2, Check, Code2, Palette, Zap, Atom, PenTool, BarChart2, Sparkles, Bookmark, Plug, FolderOpen, FolderPlus, Folder, ChevronDown, ChevronRight } from "lucide-react";
import type { DbChat } from "@/lib/supabase";
import type { AuthUser } from "@/lib/auth";
import { getStoredTheme, applyTheme, toggleTheme, type Theme } from "@/lib/theme";
import { emptyChatFolderState, readChatFolderState, writeChatFolderState, type ChatFolderState } from "@/lib/chatFolders";

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
  sessionId,
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
  onOpenIntegrations,
  activePersona,
  onSelectPersona,
  onInsertTemplate,
}: {
  chats: DbChat[];
  sessionId: string;
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
  onOpenIntegrations: () => void;
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

  // Project folders are local to the active Nexo browser session. This keeps the feature
  // useful immediately without changing the current chat schema or its access model.
  const [folderView, setFolderView] = useState(true);
  const [folderState, setFolderState] = useState<ChatFolderState>(() => emptyChatFolderState());
  const [projectCreatorOpen, setProjectCreatorOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    setFolderState(readChatFolderState(sessionId));
  }, [sessionId]);

  function updateFolderState(updater: (current: ChatFolderState) => ChatFolderState) {
    setFolderState((current) => {
      const next = updater(current);
      writeChatFolderState(sessionId, next);
      return next;
    });
  }

  function assignChatToProject(chatId: string, projectId: string) {
    updateFolderState((current) => ({
      ...current,
      assignments: projectId
        ? { ...current.assignments, [chatId]: projectId }
        : Object.fromEntries(Object.entries(current.assignments).filter(([id]) => id !== chatId)),
    }));
  }

  function toggleFolderCollapse(folderId: string) {
    updateFolderState((current) => ({
      ...current,
      collapsed: current.collapsed.includes(folderId)
        ? current.collapsed.filter((id) => id !== folderId)
        : [...current.collapsed, folderId],
    }));
  }

  function createProjectFolder() {
    const name = newProjectName.trim().replace(/\s+/g, " ");
    if (!name || folderState.folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) return;
    updateFolderState((current) => ({
      ...current,
      folders: [...current.folders, { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }],
    }));
    setNewProjectName("");
    setProjectCreatorOpen(false);
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

  // Project groups appear first. Chats outside a project stay in the familiar date-based sections.
  function getGroupedChats(): Array<{ id: string; name: string; chats: DbChat[]; isProject: boolean }> {
    if (!folderView) return [];

    const projects = folderState.folders
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        chats: chats.filter((chat) => folderState.assignments[chat.id] === folder.id),
        isProject: true,
      }));

    const autoFolders = ["Today", "Yesterday", "This Week", "Older"];
    const unassigned = chats.filter((chat) => !folderState.assignments[chat.id]);
    const datedGroups = autoFolders
      .map((name) => ({ id: `date:${name}`, name, chats: unassigned.filter((chat) => getAutoFolder(chat) === name), isProject: false }))
      .filter((group) => group.chats.length > 0);

    return [...projects, ...datedGroups];
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

          <button
            type="button"
            onClick={onOpenIntegrations}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
            aria-label="Integrations"
            title="Integrations"
          >
            <Plug className="h-4 w-4 text-ink-muted" />
            Integrations
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
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                  {folderView ? "Projects & Chats" : "Recent Chats"}
                </p>
                <div className="flex items-center gap-1">
                  {folderView && (
                    <button
                      type="button"
                      onClick={() => setProjectCreatorOpen((open) => !open)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-cyan transition hover:bg-cyan/10"
                      title="Create project folder"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      Project
                    </button>
                  )}
                  <button
                    onClick={() => setFolderView(!folderView)}
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-ink-faint transition hover:bg-panel hover:text-ink"
                    title={folderView ? "Switch to flat view" : "Switch to project view"}
                  >
                    {folderView ? <ChevronDown className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                    {folderView ? "Flat" : "Projects"}
                  </button>
                </div>
              </div>

              {folderView && projectCreatorOpen && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    createProjectFolder();
                  }}
                  className="flex items-center gap-2 rounded-xl border border-cyan/20 bg-cyan/5 p-2"
                >
                  <FolderPlus className="h-4 w-4 shrink-0 text-cyan" />
                  <input
                    autoFocus
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="Project name"
                    maxLength={48}
                    className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-faint focus:outline-none"
                  />
                  <button type="submit" className="rounded-md bg-cyan px-2 py-1 text-[10px] font-semibold text-panel transition hover:brightness-110">
                    Add
                  </button>
                </form>
              )}

              {folderView ? (
                /* Folder-grouped view */
                groupedChats.map((group) => {
                  const { id: folderId, name: folderName, chats: folderChats, isProject } = group;
                  const isCollapsed = folderState.collapsed.includes(folderId);

                  return (
                    <div key={folderId} className="space-y-1">
                      {/* Folder header */}
                      <button
                        onClick={() => toggleFolderCollapse(folderId)}
                        className="flex w-full items-center gap-1.5 px-1 py-1 text-left text-[10px] font-medium text-ink-muted transition hover:text-ink"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {isProject ? (
                          <Folder className="h-3 w-3 text-cyan" />
                        ) : (
                          <FolderOpen className="h-3 w-3 text-ink-faint" />
                        )}
                        <span className={isProject ? "tracking-wide text-ink" : "uppercase tracking-wider"}>{folderName}</span>
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
                                        value={folderState.assignments[chat.id] || ""}
                                        onChange={(event) => assignChatToProject(chat.id, event.target.value)}
                                        className="max-w-20 rounded border border-edge bg-panel px-1 py-0.5 text-[10px] text-ink-muted opacity-70 transition hover:opacity-100 focus:opacity-100 focus:outline-none"
                                        title="Move to project"
                                        aria-label={`Move ${chat.title} to project`}
                                      >
                                        <option value="">Inbox</option>
                                        {folderState.folders.map((folder) => (
                                          <option key={folder.id} value={folder.id}>{folder.name}</option>
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
