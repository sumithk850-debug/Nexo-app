import { Briefcase, Database, Layout, Zap, FileText, PenTool, Brain, Sparkles } from "lucide-react";
import { Signal } from "@/components/Signal";

export interface EmptyChatStateProps {
  isCoderMode: boolean;
  firstName: string;
  selectedRepo: string | null;
  onPrompt: (text: string) => void;
}

// Welcome screen and quick-start prompts shown before the first message.
// Presentational only: clicking a prompt hands its text to onPrompt.
export function EmptyChatState({ isCoderMode, firstName, selectedRepo, onPrompt }: EmptyChatStateProps) {
  return (
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
                        <button onClick={() => onPrompt("Build a CRM system with Next.js and Supabase")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Briefcase className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">CRM & Sales</span>
                        </button>
                        <button onClick={() => onPrompt("Create a booking app for a medical clinic")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Database className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">Booking App</span>
                        </button>
                        <button onClick={() => onPrompt("Design a SaaS landing page with Tailwind CSS")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Layout className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">SaaS Layout</span>
                        </button>
                        <button onClick={() => onPrompt("Implement a secure authentication flow")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Zap className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">Auth Logic</span>
                        </button>
                      </div>
                    )}
                    {!isCoderMode && (
                      <div aria-label="Quick start prompts" className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => onPrompt("Explain this topic clearly and summarize the key takeaways: ")} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-edge bg-panel/60 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan/50 hover:bg-panel hover:shadow-[0_8px_24px_rgba(0,229,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10 text-cyan"><FileText className="h-5 w-5" /></span>
                          <span><span className="block text-sm font-bold text-ink">Summarize</span><span className="mt-1 block text-xs leading-relaxed text-ink-muted">Get the key points, clearly explained</span></span>
                        </button>
                        <button type="button" onClick={() => onPrompt("Help me write a clear, polished draft about: ")} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-edge bg-panel/60 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan/50 hover:bg-panel hover:shadow-[0_8px_24px_rgba(0,229,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10 text-cyan"><PenTool className="h-5 w-5" /></span>
                          <span><span className="block text-sm font-bold text-ink">Write</span><span className="mt-1 block text-xs leading-relaxed text-ink-muted">Draft, rewrite, or polish your ideas</span></span>
                        </button>
                        <button type="button" onClick={() => onPrompt("Teach me this concept step by step with simple examples: ")} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-edge bg-panel/60 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan/50 hover:bg-panel hover:shadow-[0_8px_24px_rgba(0,229,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10 text-cyan"><Brain className="h-5 w-5" /></span>
                          <span><span className="block text-sm font-bold text-ink">Learn</span><span className="mt-1 block text-xs leading-relaxed text-ink-muted">Understand a concept step by step</span></span>
                        </button>
                        <button type="button" onClick={() => onPrompt("Brainstorm creative ideas for: ")} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-edge bg-panel/60 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan/50 hover:bg-panel hover:shadow-[0_8px_24px_rgba(0,229,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10 text-cyan"><Sparkles className="h-5 w-5" /></span>
                          <span><span className="block text-sm font-bold text-ink">Brainstorm</span><span className="mt-1 block text-xs leading-relaxed text-ink-muted">Explore ideas and creative directions</span></span>
                        </button>
                      </div>
                    )}
                    <p className="mt-5 hidden text-[11px] text-ink-faint sm:block">Quick tip: press <kbd className="rounded border border-edge bg-panel px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">Ctrl / ⌘ K</kbd> to search chats.</p>
                  </div>
  );
}
