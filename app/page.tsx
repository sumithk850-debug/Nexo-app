"use client";

import { useState, useRef, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Signal } from "@/components/Signal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { AuthModal } from "@/components/AuthModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SearchModal } from "@/components/SearchModal";
import { NexoCoder } from "@/components/NexoCoder";
import { ApprovalCard } from "@/components/ApprovalCard";
import { parseCraftResponse, applyDiff, type FileAction } from "@/lib/craftParser";
import { getPublicModel, type NexoModelId } from "@/lib/models";
import type { ChatMessage } from "@/lib/types";
import { getSessionId } from "@/lib/session";
import { supabase, type DbChat } from "@/lib/supabase";
import { getCurrentUser, onAuthStateChange, signOut, type AuthUser } from "@/lib/auth";
import { Settings, Code2, Sparkles, Zap, Plus, Search, Layers, Briefcase, Database, Layout, Menu } from "lucide-react";

const UNLOCKED_TIERS = ["Free"];

interface PendingApproval {
  messageId: string;
  actions: FileAction[];
  commitMessage: string;
  status: "pending" | "approving" | "approved" | "rejected" | "error";
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activePersona, setActivePersona] = useState("general");
  const [selectedModel, setSelectedModel] = useState<NexoModelId>("nexio-1.1");
  const [chats, setChats] = useState<DbChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCoderMode, setIsCoderMode] = useState(false);
  const [lastExtractedCode, setLastExtractedCode] = useState<{code: string, lang: string, file: string} | null>(null);
  const [coderLimitNotice, setCoderLimitNotice] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);
    if (sid) loadChats(sid);

    getCurrentUser().then((u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) loadSelectedRepo(u.id);
    });
    const subscription = onAuthStateChange((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  // Auto-hide the "Craft V3 credits finished" banner shortly after it appears
  useEffect(() => {
    if (!coderLimitNotice) return;
    const timer = setTimeout(() => setCoderLimitNotice(false), 6000);
    return () => clearTimeout(timer);
  }, [coderLimitNotice]);

  // Extract code from messages for the side panel and parse repository actions
  // from every model so live task and approval cards work consistently.
  // live status cards and, if it proposes real changes, an approval card.
  useEffect(() => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
    if (lastAssistantMsg) {
      const codeBlockRegex = /```(\w+)?(?:\:([\w\.]+))?\n([\s\S]*?)```/g;
      const diffBlockRegex = /```diff\:([^\n`]+)\n([\s\S]*?)```/g;
      const diffMatches = [...lastAssistantMsg.content.matchAll(diffBlockRegex)];
      const codeMatches = [...lastAssistantMsg.content.matchAll(codeBlockRegex)];
      if (diffMatches.length > 0) {
        // Diff-based edit proposals take precedence in the preview panel so
        // the side panel shows exactly what is being changed, not a stale
        // full-file snapshot.
        const lastDiff = diffMatches[diffMatches.length - 1];
        setLastExtractedCode({
          lang: "diff",
          file: lastDiff[1] || "changes",
          code: lastDiff[2].trim()
        });
      } else if (codeMatches.length > 0) {
        const lastMatch = codeMatches[codeMatches.length - 1];
        setLastExtractedCode({
          lang: lastMatch[1] || "typescript",
          file: lastMatch[2] || "component.tsx",
          code: lastMatch[3].trim()
        });
      }

      if (lastAssistantMsg.content && !isStreaming) {
        const parsed = parseCraftResponse(lastAssistantMsg.content);
        if (parsed.hasProposal) {
          setPendingApproval((prev) => {
            // Don't recreate the card if we already have one for this message
            // (e.g. avoid resetting an in-progress approve/reject state).
            if (prev?.messageId === lastAssistantMsg.id) return prev;
            return {
              messageId: lastAssistantMsg.id,
              actions: parsed.fileActions,
              commitMessage: parsed.commitMessage || "",
              status: "pending",
            };
          });
        }
      }
    }
  }, [messages, isStreaming]);

  async function loadChats(sid: string) {
    try {
      const res = await fetch(`/api/chats?sessionId=${sid}`);
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch {
      // history is a nice-to-have, not critical path
    }
  }

  async function loadSelectedRepo(userId: string) {
    try {
      const res = await fetch(`/api/github/repos?userId=${userId}`);
      const data = await res.json();
      setSelectedRepo(data.selectedRepo ?? null);
    } catch {
      setSelectedRepo(null);
    }
  }

  async function loadMessages(chatId: string) {
    setMessagesLoading(true);
    setMessages([]);
    setPendingApproval(null);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      if (data.messages) {
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            modelId: m.model_id,
          }))
        );
      }
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function ensureChat(): Promise<string | null> {
    if (activeChatId) return activeChatId;
    if (!sessionId) return null;

    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          title: "New chat",
          modelId: selectedModel,
        }),
      });
      const data = await res.json();
      if (data.chat) {
        setActiveChatId(data.chat.id);
        setChats((prev) => [data.chat, ...prev]);
        return data.chat.id;
      }
    } catch {
      // fall through
    }
    return null;
  }

  async function saveMessage(chatId: string, role: "user" | "assistant", content: string, modelId?: string) {
    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, modelId }),
      });
    } catch {
      // non-critical
    }
  }

  function handleAttach(file: File) {
    setAttachedFile(file);
  }

  async function handleAuthSuccess(isNewUser: boolean) {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    if (currentUser) loadSelectedRepo(currentUser.id);
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function handleClearHistory() {
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
    setPendingApproval(null);
    try {
      for (const chat of chats) {
        await fetch(`/api/chats?id=${chat.id}`, { method: "DELETE" });
      }
    } catch {
      // best-effort cleanup
    }
    setSettingsOpen(false);
  }

  async function handleApproveChanges() {
    if (!pendingApproval || !user) return;

    setPendingApproval({ ...pendingApproval, status: "approving" });

    // Resolve each approved action to its final file content:
    // - diffs: apply against the last known content of the file (fetched live
    //   from the repo, so we always patch the current version, not the stale
    //   prompt snapshot). Fallback → commit the diff's own content only.
    // - new files: use the full content block.
    const filesToCommit: { filePath: string; content: string; type: "editing" | "creating" | "deleting" }[] = [];
    const mutateActions = pendingApproval.actions.filter((a) => a.type !== "reading");

    for (const action of mutateActions) {
      if (action.diffHunk) {
        let original = "";
        if (user) {
          try {
            const res = await fetch(
              `/api/github/file?userId=${user.id}&path=${encodeURIComponent(action.filePath)}`,
              { headers: { "Cache-Control": "no-store" } }
            );
            if (res.ok) {
              const json = await res.json();
              original = json.content ?? "";
            }
          } catch {
            // fall back to empty original below
          }
        }
        let content = original;
        try {
          content = original
            ? applyDiff(original, action.diffHunk)
            : action.diffHunk.add.join("\n");
        } catch {
          // Anchor line not found in the live file — the model's diff is
          // stale. Safety first: do not commit a broken file; mark error.
          setPendingApproval({ ...pendingApproval, status: "error" });
          return;
        }
        if (!content.trim()) continue; // empty result → skip this file
        filesToCommit.push({ filePath: action.filePath, content, type: original ? "editing" : "creating" });
      } else {
        if (action.type !== "deleting" && !action.newContent?.trim()) continue;
        filesToCommit.push({
          filePath: action.filePath,
          content: action.newContent ?? "",
          type: action.type as "editing" | "creating" | "deleting",
        });
      }
    }

    // Nothing left after dropping empty-content actions — abort before calling
    // the commit API so we never push a blank file to the repository.
    if (filesToCommit.length === 0) {
      setPendingApproval({ ...pendingApproval, status: "rejected" });
      return;
    }

    try {
      const res = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          files: filesToCommit,
          commitMessage: pendingApproval.commitMessage || "Update via NEXO Craft V3",
        }),
      });
      const data = await res.json();

      setPendingApproval({
        ...pendingApproval,
        status: data.success ? "approved" : "error",
      });
    } catch {
      setPendingApproval({ ...pendingApproval, status: "error" });
    }
  }

  function handleRejectChanges() {
    if (!pendingApproval) return;
    setPendingApproval({ ...pendingApproval, status: "rejected" });
  }

  async function streamResponse(
    chatId: string | null,
    conversationSoFar: ChatMessage[],
    assistantId: string,
    override?: { modelId: NexoModelId; isCoder: boolean },
    uploadedImages?: { base64Image: string }[]
  ) {
    const effectiveCoder = override ? override.isCoder : isCoderMode;
    const effectiveModel = override
      ? override.modelId
      : isCoderMode
      ? "craft-v3"
      : selectedModel;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: effectiveModel,
          sessionId,
          // The user's real auth id, used server-side to look up their GitHub
          // connection (selected repo + access token) for Craft V3 requests.
          // Without this, /api/chat has no way to know which repo is active.
          userId: user?.id,
          isCoderMode: effectiveCoder,
          uploadedImages,
          messages: conversationSoFar.map((m) => ({ role: m.role, content: m.content })),
          persona: activePersona,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);

        if (res.status === 429) {
          // Craft V3 (Nexo Coder) daily limit reached → automatically fall back to
          // Nexio 1.1, flash the red notice banner, and answer with the free model.
          if (effectiveCoder) {
            setIsCoderMode(false);
            setSelectedModel("nexio-1.1");
            setCoderLimitNotice(true);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, modelId: "nexio-1.1" } : m))
            );
            await streamResponse(chatId, conversationSoFar, assistantId, {
              modelId: "nexio-1.1",
              isCoder: false,
            }, uploadedImages);
            return;
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      errData?.message ??
                      "You've reached today's message limit. Come back tomorrow, or upgrade for unlimited access.",
                  }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        // Upstream provider error (502, 500, etc.) — show friendly message
        const friendlyMsg = errData?.message ?? "Something went wrong reaching NEXO. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: friendlyMsg } : m
          )
        );
        setIsStreaming(false);
        return;
      }

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        );
      }

      if (chatId && accumulated) {
        saveMessage(chatId, "assistant", accumulated, effectiveModel);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong reaching NEXO. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleRegenerate() {
    if (isStreaming || messages.length < 2) return;

    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;

    const cutIndex = messages.length - 1 - lastUserIndex;
    const conversationSoFar = messages.slice(0, cutIndex + 1);
    const assistantId = crypto.randomUUID();

    setPendingApproval(null);
    setMessages([...conversationSoFar, { id: assistantId, role: "assistant", content: "", modelId: isCoderMode ? "craft-v3" : selectedModel }]);
    setIsStreaming(true);

    await streamResponse(activeChatId, conversationSoFar, assistantId);
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && !attachedFile) || isStreaming) return;

    const chatId = await ensureChat();

    // If the attached file is an image, convert it to base64 for the backend
    let uploadedImages: { base64Image: string }[] | undefined;
    if (attachedFile && attachedFile.type.startsWith("image/")) {
      try {
        const base64 = await fileToBase64(attachedFile);
        uploadedImages = [{ base64Image: base64 }];
      } catch (err) {
        console.error("Failed to convert image to base64:", err);
      }
    }

    const messageText = attachedFile
      ? `${text}\n\n[Attached file: ${attachedFile.name}]`
      : text;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: messageText };
    const assistantId = crypto.randomUUID();

    const nextMessages = [...messages, userMsg];
    setPendingApproval(null);
    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "", modelId: isCoderMode ? "craft-v3" : selectedModel }]);
    setInput("");
    setAttachedFile(null);
    setIsStreaming(true);

    if (chatId) saveMessage(chatId, "user", messageText);

    if (chatId && messages.length === 0) {
      const words = messageText.split(/\s+/).filter(Boolean);
      const title = words.slice(0, 5).join(" ") + (words.length > 5 ? "..." : "");
      
      fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title }),
      }).catch(() => {});

      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title } : c))
      );
    }

    await streamResponse(chatId, nextMessages, assistantId, undefined, uploadedImages);
  }

  function handleNewChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setAttachedFile(null);
    setPendingApproval(null);
  }

  async function handleSelectChat(chatId: string) {
    if (activeChatId === chatId) return;
    setActiveChatId(chatId);
    setSidebarOpen(false);
    await loadMessages(chatId);
  }

  async function handleDeleteChat(chatId: string) {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
    }
    try {
      await fetch(`/api/chats?id=${chatId}`, { method: "DELETE" });
    } catch {
      // list already updated optimistically
    }
  }

  async function handleRenameChat(chatId: string, newTitle: string) {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
    );
    try {
      await fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title: newTitle }),
      });
    } catch {
      // fail silently
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-void">
        <Signal size="lg" />
        <p className="font-mono text-xs text-ink-muted">Loading NEXO AI…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-void px-6 text-center">
        <SearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        sessionId={sessionId}
        onSelectChat={(id) => {
          setActiveChatId(id);
          loadMessages(id);
        }}
      />
      <AuthModal
          open
          mandatory
          onClose={() => {}}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  const firstName = user?.fullName?.split(" ")[0] || "there";

  return (
    <div className={`flex h-screen bg-void transition-all duration-300 ${isCoderMode ? 'ring-1 ring-inset ring-cyan/30' : ''}`}>
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
        isCoderMode={isCoderMode}
        onToggleCoderMode={() => setIsCoderMode(!isCoderMode)}
        onGlobalSearch={() => setSearchModalOpen(true)}
        activePersona={activePersona}
        onSelectPersona={setActivePersona}
        onInsertTemplate={(prompt) => setInput((prev) => (prev ? prev + "\n\n" + prompt : prompt))}
      />

      <main className="flex flex-1 flex-col overflow-hidden relative">
        {/* Animated Glow Border for Coder Mode */}
        {isCoderMode && (
          <div className="absolute inset-0 pointer-events-none z-50 border-[2px] border-cyan/20 rounded-none shadow-[inset_0_0_50px_rgba(0,229,255,0.1)] animate-pulse"></div>
        )}

        {/* Top bar with gear icon (top-right) */}
        <div className="flex items-center justify-end px-4 py-2 border-b border-edge/50">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-panel hover:text-ink"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <AnnouncementBanner />
        <AnnouncementModal />

        <div className="flex flex-1 overflow-hidden">
          <div className={`flex flex-1 flex-col transition-all duration-500 ${isCoderMode && lastExtractedCode ? 'w-1/2' : 'w-full'}`}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
              <div className="mx-auto max-w-3xl px-4 py-8">
                {messages.length === 0 ? (
                  <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-up">
                    <Signal size="lg" className="mb-8" />
                    <h1 className="font-display text-4xl font-black tracking-tight text-ink md:text-5xl">
                      {isCoderMode ? "What will you build next," : "How can I help you,"} <span className="text-cyan">{firstName}?</span>
                    </h1>
                    <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-ink-muted">
                      {isCoderMode 
                        ? "BrainEx Engine is active. Describe the app or architecture you want to create below."
                        : "Your personal AI workspace is ready. Start a new conversation or pick up where you left off."}
                    </p>

                    {isCoderMode && !selectedRepo && (
                      <p className="mt-4 max-w-md text-xs text-amber-400">
                        No repository selected — connect GitHub and pick a repo in Settings to enable code commits.
                      </p>
                    )}
                    
                    {isCoderMode && (
                      <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-lg">
                        <button onClick={() => setInput("Build a CRM system with Next.js and Supabase")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Briefcase className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">CRM & Sales</span>
                        </button>
                        <button onClick={() => setInput("Create a booking app for a medical clinic")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Database className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">Booking App</span>
                        </button>
                        <button onClick={() => setInput("Design a SaaS landing page with Tailwind CSS")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Layout className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">SaaS Layout</span>
                        </button>
                        <button onClick={() => setInput("Implement a secure authentication flow")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Zap className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">Auth Logic</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pb-12">
                    {messages.map((m, i) => {
                      const isLastAssistant = m.role === "assistant" && m === messages[messages.length - 1];
                      return (
                        <div key={m.id}>
                          <MessageBubble
                            message={m}
                            onRegenerate={isLastAssistant ? handleRegenerate : undefined}
                            coderMode={Boolean(selectedRepo)}
                            repoFullName={selectedRepo}
                          />
                          {pendingApproval &&
                            pendingApproval.messageId === m.id &&
                            !isStreaming && (
                              <ApprovalCard
                                actions={pendingApproval.actions}
                                commitMessage={pendingApproval.commitMessage}
                                repoFullName={selectedRepo}
                                status={pendingApproval.status}
                                onApprove={handleApproveChanges}
                                onReject={handleRejectChanges}
                              />
                            )}
                        </div>
                      );
                    })}
                    {isStreaming && <TypingIndicator modelId={isCoderMode ? "craft-v3" : selectedModel} />}
                  </div>
                )}
              </div>
            </div>

            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={isStreaming}
              onOpenSidebar={() => setSidebarOpen(true)}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              unlockedTiers={UNLOCKED_TIERS}
              onAttach={handleAttach}
              attachedFile={attachedFile}
              onRemoveAttach={() => setAttachedFile(null)}
              isStreaming={isStreaming}
            />
          </div>

          {/* Nexo Coder Side Panel */}
          {isCoderMode && lastExtractedCode && (
            <div className="w-1/2 border-l border-edge bg-void/50 p-4 animate-fade-left">
              <NexoCoder 
                code={lastExtractedCode.code}
                language={lastExtractedCode.lang}
                fileName={lastExtractedCode.file}
              />
            </div>
          )}
        </div>
      </main>

      {coderLimitNotice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-400 shadow-2xl backdrop-blur-xl animate-fade-up">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500 animate-pulse"></span>
            <span>NEXO Craft V3 ක්‍රෙඩිට් අද ඉවරයි — Nexo 1.1 එකට මාරු විය</span>
          </div>
        </div>
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sessionId={sessionId}
        userId={user?.id}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
            }
