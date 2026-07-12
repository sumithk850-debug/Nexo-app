// NEXO AI — Model Registry
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
}

// Client-safe metadata — safe to import in components
export const NEXO_MODELS: NexoModelPublic[] = [
  {
    id: "nexio-1.1",
    name: "NEXO Nexio 1.1",
    tagline: "Lightning fast everyday assistant",
    tier: "Free",
    badge: "FREE",
  },
  {
    id: "spadec-3.5",
    name: "NEXO Spadec 3.5",
    tagline: "Enhanced reasoning & creativity",
    tier: "Free",
    badge: "FREE",
  },
  {
    id: "galex-4.0",
    name: "NEXO Galex 4.0",
    tagline: "Balanced power + ultra speed",
    tier: "Galex",
    badge: "GALEX",
  },
  {
    id: "brainex-10.8",
    name: "NEXO Brainex 10.8",
    tagline: "Deep research & rigorous analysis",
    tier: "Brainex",
    badge: "BRAINEX",
  },
  {
    id: "craft-v3",
    name: "NEXO Craft V3",
    tagline: "Maximum power for coding & creation",
    tier: "Craft",
    badge: "CRAFT",
  },
];

export function getPublicModel(id: NexoModelId): NexoModelPublic | undefined {
  return NEXO_MODELS.find((m) => m.id === id);
}
