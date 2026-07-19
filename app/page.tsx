"use client";

import { useState, useRef, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Signal } from "@/components/Signal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AuthModal } from "@/components/AuthModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { NexoCoder } from "@/components/NexoCoder";
import { getPublicModel, type NexoModelId } from "@/lib/models";
import type { ChatMessage } from "@/lib/types";
import { getSessionId } from "@/lib/session";
import { supabase, type DbChat } from "@/lib/supabase";
import { getCurrentUser, onAuthStateChange, signOut, type AuthUser } from "@/lib/auth";
import { Settings, Code2, Sparkles, Zap, Plus, Search, Layers, Briefcase, Database, Layout, Menu } from "lucide-react";

const UNLOCKED_TIERS = ["Free"];

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);
    if (sid) loadChats(sid);

    getCurrentUser().then((u) => {
      setUser(u);
      setAuthLoading(false);
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

  // Extract code from messages for Nexo Coder
  useEffect(() => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
    if (lastAssistantMsg) {
      const codeBlockRegex = /```(\w+)?(?:\:([\w\.]+))?\n([\s\S]*?)```/g;
      const matches = [...lastAssistantMsg.content.matchAll(codeBlockRegex)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        setLastExtractedCode({
          lang: lastMatch[1] || "typescript",
          file: lastMatch[2] || "component.tsx",
          code: lastMatch[3].trim()
        });
      }
    }
  }, [messages]);

  async function loadChats(sid: string) {
    try {
      const res = await fetch(`/api/chats?sessionId=${sid}`);
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch {
      // history is a nice-to-have, not critical path
    }
  }

  async function loadMessages(chatId: string) {
    setMessagesLoading(true);
    setMessages([]);
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
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function handleClearHistory() {
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
    try {
      for (const chat of chats) {
        await fetch(`/api/chats?id=${chat.id}`, { method: "DELETE" });
      }
    } catch {
      // best-effort cleanup
    }
    setSettingsOpen(false);
  }

  async function streamResponse(
    chatId: string | null,
    conversationSoFar: ChatMessage[],
    assistantId: string
  ) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: isCoderMode ? "craft-v3" : selectedModel,
          sessionId,
          isCoderMode,
          messages: conversationSoFar.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 429) {
        const errData = await res.json().catch(() => null);
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
        saveMessage(chatId, "assistant", accumulated, isCoderMode ? "craft-v3" : selectedModel);
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

    setMessages([...conversationSoFar, { id: assistantId, role: "assistant", content: "", modelId: isCoderMode ? "craft-v3" : selectedModel }]);
    setIsStreaming(true);

    await streamResponse(activeChatId, conversationSoFar, assistantId);
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && !attachedFile) || isStreaming) return;

    const chatId = await ensureChat();

    const messageText = attachedFile
      ? `${text}\n\n[Attached file: ${attachedFile.name}]`
      : text;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: messageText };
    const assistantId = crypto.randomUUID();

    const nextMessages = [...messages, userMsg];
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

    await streamResponse(chatId, nextMessages, assistantId);
  }

  function handleNewChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setAttachedFile(null);
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
                  <div className="space-y-8 pb-12">
                    {messages.map((m) => (
                      <MessageBubble 
                        key={m.id} 
                        message={m} 
                        onRegenerate={m.role === "assistant" && m === messages[messages.length - 1] ? handleRegenerate : undefined}
                      />
                    ))}
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

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sessionId={sessionId}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
