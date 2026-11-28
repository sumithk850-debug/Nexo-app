// KYVORIX AI — Model Registry
// Underlying provider/model info is used server-side only (app/api/chat/route.ts)
// and must NEVER be sent to the client or exposed in any public-facing type.

export type NexoModelId =
  | "nexio-1.1"
  | "spadec-3.5"
  | "galex-4.0"
  | "brainex-10.8"
  | "craft-v3";

export interface NexoModelPublic {
  id: NexoModelId;
  name: string;
  tagline: string;
  tier: "Free" | "Galex" | "Brainex" | "Craft";
  badge: string;
  isNew?: boolean;
}

// Client-safe metadata — safe to import in components
export const NEXO_MODELS: NexoModelPublic[] = [
  {
    id: "nexio-1.1",
    name: "KYVORIX Nexio 1.1",
    tagline: "Lightning fast everyday assistant",
    tier: "Free",
    badge: "FREE",
  },
  {
    id: "spadec-3.5",
    name: "KYVORIX Gemma 4 26B A4B",
    tagline: "Fast everyday chat powered by Gemma 4",
    tier: "Free",
    badge: "GEMMA",
  },
  {
    id: "galex-4.0",
    name: "KYVORIX Gemma 4 31B",
    tagline: "Advanced reasoning powered by Gemma 4",
    tier: "Galex",
    badge: "GEMMA",
    isNew: true,
  },
  {
    id: "brainex-10.8",
    name: "KYVORIX Brainex 10.8",
    tagline: "Deep research & rigorous analysis",
    tier: "Brainex",
    badge: "BRAINEX",
  },
  {
    id: "craft-v3",
    name: "KYVORIX Craft V3",
    tagline: "Maximum power for coding & creation",
    tier: "Craft",
    badge: "CRAFT",
  },
];

export function getPublicModel(id: NexoModelId): NexoModelPublic | undefined {
  return NEXO_MODELS.find((m) => m.id === id);
}
