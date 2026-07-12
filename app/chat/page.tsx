"use client";

import { useState, useRef, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Signal } from "@/components/Signal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AuthModal } from "@/components/AuthModal";
import { getPublicModel, type NexoModelId } from "@/lib/models";
import type { ChatMessage } from "@/lib/types";
import { getSessionId } from "@/lib/session";
import { supabase, type DbChat } from "@/lib/supabase";
import { getCurrentUser, onAuthStateChange, signOut, type AuthUser } from "@/lib/auth";
import { X, FileText } from "lucide-react";

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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<NexoModelId>("nexio-1.1");
  const [chats, setChats] = useState<DbChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);
    if (sid) loadChats(sid);

    getCurrentUser().then((u) => setUser(u));
    const subscription = onAuthStateChange((u) => setUser(u));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
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

  async function loadMessages(chatId: string) {
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
      // Show the welcome message directly in the current chat window.
      const welcomeMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: WELCOME_MESSAGE,
        modelId: selectedModel,
      };
      setMessages((prev) => [...prev, welcomeMsg]);

      // Mark as welcomed in the DB so we never repeat this on future logins.
      await supabase
        .from("profiles")
        .update({ welcomed: true })
        .eq("id", currentUser.id);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
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
    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "", modelId: selectedModel }]);
    setInput("");
    setAttachedFile(null);
    setIsStreaming(true);

    if (chatId) saveMessage(chatId, "user", messageText);

    if (chatId && messages.length === 0) {
      const title = messageText.slice(0, 40) + (messageText.length > 40 ? "…" : "");
      fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, title, modelId: selectedModel }),
      }).catch(() => {});
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title } : c))
      );
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModel,
          sessionId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
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
        saveMessage(chatId, "assistant", accumulated, selectedModel);
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

  function handleNewChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setAttachedFile(null);
  }

  async function handleSelectChat(chatId: string) {
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

  const activeModel = getPublicModel(selectedModel);

  return (
    <div className="flex h-screen bg-void">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AnnouncementBanner />

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState modelName={activeModel?.name ?? ""} />
          ) : (
            <div className="mx-auto max-w-3xl py-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}
            </div>
          )}
        </div>

        {attachedFile && (
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 pb-2">
            <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5 text-xs text-ink-muted">
              <FileText className="h-3.5 w-3.5 text-cyan" />
              <span className="max-w-[200px] truncate">{attachedFile.name}</span>
              <button
                onClick={() => setAttachedFile(null)}
                className="text-ink-faint hover:text-ink"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

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
        />
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

function EmptyState({ modelName }: { modelName: string }) {
  const suggestions = [
    "Explain quantum computing simply",
    "Write a birthday wish in Sinhala",
    "Help me plan a weekend trip",
    "Debug this JavaScript function",
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Signal size="lg" />
      <h2 className="mt-6 font-display text-2xl font-bold text-ink">
        Chatting with {modelName}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Ask anything. Switch models anytime from the input bar.
      </p>
      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <div
            key={s}
            className="rounded-xl border border-edge bg-panel px-4 py-3 text-left text-sm text-ink-muted"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
