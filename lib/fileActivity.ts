import type { FileAction } from "./craftParser";
import type { FileActivityArtifact } from "./types";

function languageFromPath(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  const languages: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", json: "json", css: "css", html: "html", md: "markdown",
    yml: "yaml", yaml: "yaml", sql: "sql", sh: "bash",
  };
  return languages[extension] ?? "text";
}

export function countFileLines(content: string): number {
  return content === "" ? 0 : content.split("\n").length;
}

export function createVerifiedReadActivities(paths: string[]): FileActivityArtifact[] {
  return [...new Set(paths.filter(Boolean))].map((filePath) => ({
    id: `read:${filePath}`,
    action: "reading",
    filePath,
    language: languageFromPath(filePath),
    state: "loading",
    message: "Fetching the verified live file…",
  }));
}

export function createProposedFileActivities(actions: FileAction[]): FileActivityArtifact[] {
  return actions
    .filter((action) => action.type !== "reading")
    .map((action) => ({
      id: `proposal:${action.type}:${action.filePath}`,
      action: action.type,
      filePath: action.filePath,
      language: action.language ?? languageFromPath(action.filePath),
      state: "proposed" as const,
      content: action.newContent,
      diff: action.diffRaw,
      lineCount: action.newContent ? countFileLines(action.newContent) : undefined,
      additions: action.diffHunk?.add.length,
      deletions: action.diffHunk?.remove.length,
      message: "Proposed change — not committed yet.",
    }));
}

export function mergeFileActivities(
  existing: FileActivityArtifact[] | undefined,
  incoming: FileActivityArtifact[]
): FileActivityArtifact[] {
  const current = existing ?? [];
  const merged = [...current];
  let changed = false;
  for (const artifact of incoming) {
    const index = merged.findIndex((current) => current.id === artifact.id);
    if (index === -1) {
      merged.push(artifact);
      changed = true;
    }
    else {
      const next = { ...merged[index], ...artifact };
      const unchanged = Object.keys(next).every((key) => (
        next[key as keyof FileActivityArtifact] === merged[index][key as keyof FileActivityArtifact]
      )) && Object.keys(merged[index]).every((key) => (
        next[key as keyof FileActivityArtifact] === merged[index][key as keyof FileActivityArtifact]
      ));
      if (!unchanged) {
        merged[index] = next;
        changed = true;
      }
    }
  }
  return changed ? merged : current;
}
