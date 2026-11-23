// KYVORIX AI — Coder model metadata (client-safe).
//
// This module intentionally contains ONLY public display/access metadata.
// It must never import provider routes, API keys, or system prompts: client
// components such as CoderModelSelector import it, and anything reachable from
// here is shipped to the browser. Server-side routing and prompts live in
// lib/providers.server.ts, which re-exports these symbols for server callers.

// Coder sub-model variant — only exposed inside Kyvorix Coder Agent mode.
// Craft V5 is routed server-side through the Brainex 10.8 engine route (see
// app/api/chat/route.ts) and activates a stricter orchestration and
// verification protocol through its dedicated system prompt.
export const CODER_MODEL_IDS = ["craft-v3-lite", "craft-v5", "craft-v3", "craft-v4"] as const;
export type CoderModelId = (typeof CODER_MODEL_IDS)[number];

export interface CoderModelInfo {
  id: CoderModelId;
  name: string;
  badge: "LITE" | "TRIAL" | "PRO";
  locked: boolean;
  engine: "craft-v3" | "craft-v4" | "craft-v5";
}

export const CODER_MODELS: CoderModelInfo[] = [
  { id: "craft-v3-lite", name: "Craft V3 Lite", badge: "LITE", locked: false, engine: "craft-v3" },
  { id: "craft-v5", name: "Craft V5", badge: "TRIAL", locked: false, engine: "craft-v5" },
  { id: "craft-v3", name: "Craft V3", badge: "PRO", locked: true, engine: "craft-v3" },
  { id: "craft-v4", name: "Craft V4", badge: "PRO", locked: true, engine: "craft-v4" },
];

export function isCoderModelId(id: string): id is CoderModelId {
  return (CODER_MODEL_IDS as readonly string[]).includes(id);
}
