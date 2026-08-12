"use client";

import { useState, useEffect } from "react";
import { Zap, ArrowRight } from "lucide-react";

/**
 * Generates smart reply suggestions from the assistant's last message.
 * Uses simple client-side pattern matching — no API calls, zero cost.
 */
function generateSuggestions(content: string): string[] {
  const text = content.toLowerCase();
  const suggestions: string[] = [];

  // Code-related suggestions
  if (/```/i.test(content) && /code|function|class|const |let |var /i.test(text)) {
    if (suggestions.length < 4) suggestions.push("Can you explain this code?");
    if (suggestions.length < 4) suggestions.push("Add error handling to this");
    if (suggestions.length < 4) suggestions.push("Optimize this for performance");
    if (suggestions.length < 4) suggestions.push("Convert this to TypeScript");
  }

  // General suggestions based on content type
  if (/explain|understand|meaning/i.test(text)) {
    if (suggestions.length < 4) suggestions.push("Give me an example");
    if (suggestions.length < 4) suggestions.push("How can I apply this?");
  }

  if (/step|steps|first|then|next/i.test(text)) {
    if (suggestions.length < 4) suggestions.push("What's the next step?");
    if (suggestions.length < 4) suggestions.push("Show me more details");
  }

  if (/error|bug|issue|problem|fix/i.test(text)) {
    if (suggestions.length < 4) suggestions.push("How do I prevent this?");
    if (suggestions.length < 4) suggestions.push("What are common causes?");
  }

  if (/compare|difference|vs\.|versus/i.test(text)) {
    if (suggestions.length < 4) suggestions.push("Which one is better?");
    if (suggestions.length < 4) suggestions.push("What are the pros and cons?");
  }

  if (/list|types|kinds|categories/i.test(text)) {
    if (suggestions.length < 4) suggestions.push("Tell me more about each one");
    if (suggestions.length < 4) suggestions.push("Which is most important?");
  }

  if (/how to|tutorial|guide|learn/i.test(text)) {
    if (suggestions.length < 4) suggestions.push("What do I need to start?");
    if (suggestions.length < 4) suggestions.push("Give me best practices");
  }

  // Default fallback suggestions (always available)
  while (suggestions.length < 3) {
    const defaults = [
      "Tell me more",
      "Give an example",
      "How can I improve this?",
    ];
    if (!suggestions.includes(defaults[suggestions.length])) {
      suggestions.push(defaults[suggestions.length]);
    } else {
      break;
    }
  }

  return suggestions.slice(0, 3);
}

export function SmartReplySuggestions({
  lastMessageContent,
  onSelect,
  disabled,
}: {
  lastMessageContent: string;
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!lastMessageContent || disabled) {
      setSuggestions([]);
      return;
    }
    const gen = generateSuggestions(lastMessageContent);
    setSuggestions(gen.length > 0 ? gen : ["Tell me more", "Give an example", "What else can you do?"]);
  }, [lastMessageContent, disabled]);

  if (suggestions.length === 0) return null;

  return (
    <div className="mx-4 mb-3 flex flex-wrap gap-2">
      {suggestions.map((s, i) => (
        <button
          key={`${s}-${i}`}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="group flex items-center gap-1.5 rounded-full border border-edge/50 bg-panel/50 px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-cyan/40 hover:bg-cyan/5 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <Zap className="h-3 w-3 text-cyan/60 group-hover:text-cyan" />
          {s}
          <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
