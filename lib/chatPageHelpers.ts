import { createSupabaseReadBlock, type SupabaseReadCardData } from "@/lib/supabaseReadParser";
import type { FileAction } from "@/lib/craftParser";

// Drafts are intentionally stored only in this browser and scoped to KYVORIX's
// existing session ID. Attachments are never persisted because File objects
// may contain private data and cannot be restored reliably after a reload.
export const DRAFT_STORAGE_PREFIX = "kyvorix.chatDrafts:";
export const NEW_CHAT_DRAFT_ID = "__new__";
export const MAX_DRAFT_LENGTH = 100_000;

export type DraftStore = Record<string, string>;

export function getDraftStorageKey(sessionId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${sessionId}`;
}

export function readDraftStore(sessionId: string): DraftStore {
  if (typeof window === "undefined" || !sessionId) return {};
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(sessionId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => typeof key === "string" && typeof value === "string" && value.length <= MAX_DRAFT_LENGTH
      )
    );
  } catch {
    // localStorage can be unavailable or contain malformed data; drafts are
    // best-effort and must never block the chat UI.
    return {};
  }
}

export function writeDraftStore(sessionId: string, drafts: DraftStore): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    if (Object.keys(drafts).length === 0) {
      window.localStorage.removeItem(getDraftStorageKey(sessionId));
    } else {
      window.localStorage.setItem(getDraftStorageKey(sessionId), JSON.stringify(drafts));
    }
  } catch {
    // Quota/private-mode failures must not affect sending messages.
  }
}

export function removeDraft(sessionId: string, draftId: string): void {
  const drafts = readDraftStore(sessionId);
  if (!(draftId in drafts)) return;
  delete drafts[draftId];
  writeDraftStore(sessionId, drafts);
}

export function containsGithubToken(value: string): boolean {
  return /(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})/.test(value);
}


export type AttachmentPreparation = {
  names: string[];
  state: "preparing" | "error";
  message?: string;
};

export function readVerifiedPaths(response: Response): string[] {
  const raw = response.headers.get("X-Kyvorix-Verified-Reads");
  if (!raw) return [];
  try {
    const paths = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(paths)
      ? paths.filter((path): path is string => typeof path === "string" && path.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function normalizeRepositoryReadClaims(content: string, verifiedPaths: string[]): string {
  const verified = new Set(verifiedPaths);
  const withoutUnverifiedMarkers = content.replace(
    /^\[READING FILE\]\s*([^\n]+)$/gim,
    (marker, rawPath: string) => {
      const path = rawPath.trim();
      return verified.has(path)
        ? marker
        : `Repository read not verified for \`${path}\`. No file findings are shown for it.`;
    }
  );

  // A model-generated summary is allowed to describe changes, but its read
  // inventory must be grounded in files the server actually fetched this turn.
  return withoutUnverifiedMarkers.replace(/```task-summary\n([\s\S]*?)```/gi, (_block, details: string) => {
    const normalizedDetails = details
      .split("\n")
      .map((line) => line.trimStart().toLowerCase().startsWith("files read:")
        ? `files read: ${verifiedPaths.join(", ")}`
        : line
      )
      .join("\n");
    return `\`\`\`task-summary\n${normalizedDetails}\n\`\`\``;
  });
}

export function liveReadCard(card: Omit<SupabaseReadCardData, "id">) {
  return createSupabaseReadBlock(card);
}

export interface PendingApproval {
  messageId: string;
  actions: FileAction[];
  commitMessage: string;
  status: "pending" | "approving" | "approved" | "rejected" | "error";
}
