"use client";

import { useState, useEffect, useRef } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { NexoCoderHome } from "@/components/NexoCoder";
import { TypingIndicator } from "@/components/TypingIndicator";
import { AuthModal } from "@/components/AuthModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Signal } from "@/components/Signal";
import { 
  getCurrentUser, 
  signOut, 
  onAuthStateChange,
  type AuthUser 
} from "@/lib/auth";
import { 
  supabase, 
  type DbChat, 
  type ChatMessage 
} from "@/lib/supabase";
import { NEXO_MODELS, type NexoModelId } from "@/lib/models";

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chats, setChats] = useState<DbChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<NexoModelId>("nexio-1.1");
  const [isCoderMode, setIsCoderMode] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate or get session ID
    let sid = localStorage.getItem("nexo_session_id");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("nexo_session_id", sid);
    }
    setSessionId(sid);

    // Auth listener
    const checkUser = async () => {
      const u = await getCurrentUser();
      setUser(u);
    };
    checkUser();

    const subscription = onAuthStateChange((u) => {
      setUser(u);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadChats();
    } else {
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
    }
  }, [user]);

  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function loadChats() {
    if (!user) return;
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setChats(data);
    }
  }

  async function loadMessages(chatId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  }

  async function handleNewChat() {
    setActiveChatId(null);
    setMessages([]);
    setIsCoderMode(false);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  async function handleSelectChat(id: string) {
    if (id === activeChatId) return;
    setActiveChatId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  async function handleDeleteChat(id: string) {
    const { error } = await supabase.from("chats").delete().eq("id", id);
    if (!error) {
      if (activeChatId === id) {
        setActiveChatId(null);
        setMessages([]);
      }
      loadChats();
    }
  }

  async function handleRenameChat(id: string, newTitle: string) {
    const { error } = await supabase
      .from("chats")
      .update({ title: newTitle })
      .eq("id", id);
    if (!error) {
      loadChats();
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function handleClearHistory() {
    if (!user) return;
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
    try {
      await supabase.from("chats").delete().eq("user_id", user.id);
    } catch (e) {
      console.error("Error clearing history:", e);
    }
    setSettingsOpen(false);
  }

  async function ensureChat(): Promise<string> {
    if (activeChatId) return activeChatId;

    if (!user) {
      setAuthModalOpen(true);
      throw new Error("Auth required");
    }

    // Auto-title from first 5 words
    const title = input.trim().split(/\s+/).slice(0, 5).join(" ") || "New Chat";
    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title: title.length > 40 ? title.substring(0, 40) + "..." : title,
      })
      .select()
      .single();

    if (error || !data) throw new Error("Failed to create chat");
    
    setActiveChatId(data.id);
    loadChats();
    return data.id;
  }

  async function streamResponse(
    chatId: string,
    conversationSoFar: ChatMessage[],
    assistantMsgId: string
  ) {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          messages: conversationSoFar,
          modelId: isCoderMode ? "craft-v3" : selectedModel,
          isCoderMode,
        }),
      });

      if (!response.ok) throw new Error("Chat API failed");

      const reader = response.body?.getReader();
      if (!reader) return;

      let accumulatedContent = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedContent += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
          )
        );
      }

      // Final save to DB
      await supabase.from("messages").insert({
        id: assistantMsgId,
        chat_id: chatId,
        role: "assistant",
        content: accumulatedContent,
        model_id: isCoderMode ? "craft-v3" : selectedModel,
      });
    } catch (error) {
      console.error("Streaming error:", error);
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleRegenerate() {
    if (isStreaming || messages.length < 2 || !activeChatId) return;

    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;

    const cutIndex = messages.length - 1 - lastUserIndex;
    const conversationSoFar = messages.slice(0, cutIndex + 1);
    const assistantId = crypto.randomUUID();

    setMessages([...conversationSoFar, { 
      id: assistantId, 
      chat_id: activeChatId,
      role: "assistant", 
      content: "", 
      model_id: isCoderMode ? "craft-v3" : (selectedModel as any),
      created_at: new Date().toISOString()
    }]);
    setIsStreaming(true);

    await streamResponse(activeChatId, conversationSoFar, assistantId);
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && !attachedFile) || isStreaming) return;

    try {
      const chatId = await ensureChat();
      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      const newUserMsg: ChatMessage = {
        id: userMsgId,
        chat_id: chatId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };

      const newAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        chat_id: chatId,
        role: "assistant",
        content: "",
        model_id: isCoderMode ? "craft-v3" : (selectedModel as any),
        created_at: new Date().toISOString(),
      };

      const updatedMessages = [...messages, newUserMsg];
      setMessages([...updatedMessages, newAssistantMsg]);
      setInput("");
      setAttachedFile(null);
      setIsStreaming(true);

      // Save user message
      await supabase.from("messages").insert(newUserMsg);

      await streamResponse(chatId, updatedMessages, assistantMsgId);
    } catch (e) {
      console.error("Send error:", e);
    }
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
          <div className="absolute inset-0 pointer-events-none z-50 ring-1 ring-inset ring-cyan/20 animate-pulse" />
        )}

        <div className="flex-1 overflow-y-auto">
          {isCoderMode && messages.length === 0 ? (
            <NexoCoderHome 
              onAction={(action) => setInput(action)} 
              userName={firstName}
            />
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
              {messages.length === 0 ? (
                <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-up">
                  <Signal size="lg" className="mb-8" />
                  <h1 className="font-display text-4xl font-black tracking-tight text-ink md:text-5xl">
                    {isCoderMode ? "What will you build next," : "How can I help you,"} <span className="text-cyan">{firstName}?</span>
                  </h1>
                  <p className="mt-4 text-ink-muted">
                    {isCoderMode 
                      ? "Describe your app idea and BrainEx will architect it for you." 
                      : "The most powerful AI assistant tailored for Sri Lanka."}
                  </p>
                </div>
              ) : (
                <div className="space-y-8 pb-32">
                  {messages.map((m) => (
                    <MessageBubble 
                      key={m.id} 
                      message={m} 
                      onRegenerate={m.role === "assistant" && m === messages[messages.length - 1] ? handleRegenerate : undefined}
                    />
                  ))}
                  {isStreaming && <TypingIndicator modelId={isCoderMode ? "craft-v3" : selectedModel} />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-edge bg-void/80 backdrop-blur-md px-4 py-4 md:px-8">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={isStreaming}
              placeholder={isCoderMode ? "Describe the app you want to create..." : "Ask NEXO anything..."}
              modelId={isCoderMode ? "craft-v3" : selectedModel}
              onModelChange={(id) => setSelectedModel(id as NexoModelId)}
              isCoderMode={isCoderMode}
              attachedFile={attachedFile}
              onRemoveAttach={() => setAttachedFile(null)}
              isStreaming={isStreaming}
            />
            <p className="mt-2 text-center text-[10px] text-ink-faint">
              NEXO can make mistakes. Check important info. Built for Sri Lanka.
            </p>
          </div>
        </div>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sessionId={sessionId}
        onClearHistory={handleClearHistory}
      />

      <AuthModal 
        open={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        onSuccess={(isNewUser) => {
          setAuthModalOpen(false);
          // Refresh page or user state if needed
          window.location.reload();
        }}
      />
    </div>
  );
}
