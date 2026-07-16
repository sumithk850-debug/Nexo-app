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
import { Settings, Code2, Sparkles } from "lucide-react";

const UNLOCKED_TIERS = ["Free"];

const WELCOME_MESSAGE = `Thank you for joining NEXO AI! 🎉

I'm so glad you're here. From now on, your conversations will be saved to your account — sign in from any device and pick up right where you left off.

A few things to try:
- Switch between all 5 NEXO models from the input bar
- Attach a file or photo to a message
- Ask me anything, in Sinhala or English

Welcome aboard — let's build something great together.

— NEXO AI`;

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
      if (u) checkBirthday(u.id);
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

  async function checkBirthday(userId: string) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, birthday, last_birthday_wish_year")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.birthday) return;

      const today = new Date();
      const bday = new Date(profile.birthday);
      const isBirthdayToday =
        today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
      const alreadyWishedThisYear = profile.last_birthday_wish_year === today.getFullYear();

      if (isBirthdayToday && !alreadyWishedThisYear) {
        const name = profile.full_name?.split(" ")[0] || "there";
        const wishMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `🎉 Happy Birthday, ${name}!

Wishing you a day filled with joy, good company, and everything that makes you smile. Thank you for being part of the NEXO AI family — here's to another wonderful year ahead. 🎂

— NEXO AI`,
          modelId: "nexio-1.1",
        };
        setMessages((prev) => [...prev, wishMsg]);

        await supabase
          .from("profiles")
          .update({ last_birthday_wish_year: today.getFullYear() })
          .eq("id", userId);
      }
    } catch {
      // birthday wish is a nice-to-have, fail silently
    }
  }

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

    if (isNewUser && currentUser) {
      const welcomeMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: WELCOME_MESSAGE,
        modelId: selectedModel,
      };
      setMessages((prev) => [...prev, welcomeMsg]);

      await supabase
        .from("profiles")
        .update({ welcomed: true })
        .eq("id", currentUser.id);
    } else if (currentUser) {
      checkBirthday(currentUser.id);
    }
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

  const activeModel = getPublicModel(selectedModel);

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
        <div className="flex flex-col items-center gap-5">
          <Signal size="lg" />
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">
              NEXO<span className="text-cyan">AI</span>
            </h1>
            <p className="mt-2 max-w-sm text-sm text-ink-muted">
              Sign in or create an account to start chatting. Your conversations and profile are saved to your account.
            </p>
          </div>
        </div>

        <AuthModal
          open
          mandatory
          onClose={() => {}}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-void transition-colors duration-300">
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

      <div className="flex min-w-0 flex-1 flex-col">
        <AnnouncementBanner />

        <div className="flex items-center justify-between border-b border-edge px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-ink-muted hover:text-ink"
            >
              <Signal size="sm" />
            </button>
            {isCoderMode && (
              <div className="flex items-center gap-2 rounded-full bg-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan">
                <Sparkles className="h-3 w-3" />
                Nexo Coder Active
              </div>
            )}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-panel hover:text-ink"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Chat Section */}
          <div className={`flex flex-col min-w-0 transition-all duration-500 ${isCoderMode ? 'w-1/2' : 'w-full'}`}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {messagesLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <Signal size="md" />
                  <p className="font-mono text-xs text-ink-muted">Loading conversation…</p>
                </div>
              ) : messages.length === 0 ? (
                <EmptyState modelName={isCoderMode ? "Nexo Coder" : activeModel?.name ?? ""} />
              ) : (
                <div className="mx-auto w-full max-w-3xl py-4">
                  {messages.map((m, i) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isLast={i === messages.length - 1 && m.role === "assistant"}
                      onRegenerate={handleRegenerate}
                    />
                  ))}
                  {isStreaming && messages[messages.length - 1]?.content === "" && (
                    <TypingIndicator />
                  )}
                </div>
              )}
            </div>

            <div className="mx-auto w-full max-w-3xl p-4">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                onAttach={handleAttach}
                attachedFile={attachedFile}
                onRemoveAttach={() => setAttachedFile(null)}
                isStreaming={isStreaming}
                selectedModel={isCoderMode ? "craft-v3" : selectedModel}
                onSelectModel={setSelectedModel}
                disabled={isStreaming}
              />
            </div>
          </div>

          {/* Nexo Coder Preview Section */}
          {isCoderMode && (
            <div className="w-1/2 border-l border-edge p-4 bg-void/50 animate-fade-up">
              {lastExtractedCode ? (
                <NexoCoder 
                  code={lastExtractedCode.code} 
                  language={lastExtractedCode.lang} 
                  fileName={lastExtractedCode.file}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-edge bg-panel/30 p-8 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-panel text-ink-faint">
                    <Code2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-ink">Waiting for Code</h3>
                  <p className="mt-2 max-w-xs text-xs text-ink-muted">
                    Ask Nexo Coder to write some code, and it will appear here for review and preview.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClearHistory={handleClearHistory}
        sessionId={sessionId}
      />
    </div>
  );
}

function EmptyState({ modelName }: { modelName: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-panel shadow-sm">
        <Signal size="md" />
      </div>
      <h2 className="font-display text-xl font-bold text-ink">
        How can <span className="text-cyan">{modelName}</span> help you?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Start a new conversation or pick up where you left off. Nexo is ready to assist you in Sinhala or English.
      </p>
    </div>
  );
}
