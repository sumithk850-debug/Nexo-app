export interface ChatProjectFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChatFolderState {
  folders: ChatProjectFolder[];
  assignments: Record<string, string>;
  collapsed: string[];
}

const STORAGE_PREFIX = "nexo:chat-project-folders:";
const LEGACY_STORAGE_KEY = "nexo_chat_folders";

export function getChatFolderStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId || "anonymous"}`;
}

function isFolder(value: unknown): value is ChatProjectFolder {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.createdAt === "string";
}

function isAssignments(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.values(value as Record<string, unknown>).every((id) => typeof id === "string");
}

export function emptyChatFolderState(): ChatFolderState {
  return { folders: [], assignments: {}, collapsed: [] };
}

/**
 * Reads folders only from the current Nexo browser session. A legacy assignment map is
 * migrated once into session-scoped project folders so existing user organization is preserved.
 */
export function readChatFolderState(sessionId: string): ChatFolderState {
  if (typeof window === "undefined") return emptyChatFolderState();

  try {
    const raw = window.localStorage.getItem(getChatFolderStorageKey(sessionId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const candidate = parsed as Partial<ChatFolderState>;
        return {
          folders: Array.isArray(candidate.folders) ? candidate.folders.filter(isFolder) : [],
          assignments: isAssignments(candidate.assignments) ? candidate.assignments : {},
          collapsed: Array.isArray(candidate.collapsed) ? candidate.collapsed.filter((id): id is string => typeof id === "string") : [],
        };
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return emptyChatFolderState();
    const legacy: unknown = JSON.parse(legacyRaw);
    if (!isAssignments(legacy)) return emptyChatFolderState();

    const names = [...new Set(Object.values(legacy).map((name) => name.trim()).filter(Boolean))];
    const folders = names.map((name) => ({
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    }));
    const idsByName = new Map(folders.map((folder) => [folder.name, folder.id]));
    const assignments = Object.fromEntries(
      Object.entries(legacy)
        .map(([chatId, folderName]) => [chatId, idsByName.get(folderName)] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
    );
    const migrated = { folders, assignments, collapsed: [] };
    writeChatFolderState(sessionId, migrated);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  } catch {
    return emptyChatFolderState();
  }
}

export function writeChatFolderState(sessionId: string, state: ChatFolderState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getChatFolderStorageKey(sessionId), JSON.stringify(state));
  } catch {
    // Folder organization is an enhancement and must never interfere with chat access.
  }
}
