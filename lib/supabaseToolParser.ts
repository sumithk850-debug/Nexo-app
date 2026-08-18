export const SUPABASE_READ_TOOL_NAMES = [
  "list_projects",
  "list_tables",
  "describe_table",
  "read_rows",
] as const;

export type SupabaseReadToolName = (typeof SUPABASE_READ_TOOL_NAMES)[number];

export interface SupabaseReadToolIntent {
  tool: SupabaseReadToolName;
  projectId?: string;
  table?: string;
  columns?: string[];
  limit?: number;
}

const TOOL_BLOCK_PATTERN = /<supabase-tool>\s*([\s\S]*?)\s*<\/supabase-tool>/gi;

type RawToolIntent = {
  action?: unknown;
  tool?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  table?: unknown;
  columns?: unknown;
  limit?: unknown;
};

function readSafeColumns(raw: unknown) {
  return Array.isArray(raw)
    ? raw.filter((column): column is string => typeof column === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)).slice(0, 12)
    : undefined;
}

export function parseSupabaseReadToolIntents(content: string): SupabaseReadToolIntent[] {
  const intents: SupabaseReadToolIntent[] = [];
  let match: RegExpExecArray | null;

  while ((match = TOOL_BLOCK_PATTERN.exec(content)) !== null) {
    let raw: RawToolIntent;
    try {
      raw = JSON.parse(match[1]) as RawToolIntent;
    } catch {
      continue;
    }
    const tool = (typeof raw.action === "string" ? raw.action : raw.tool) as SupabaseReadToolName;
    const projectId = typeof raw.project_id === "string"
      ? raw.project_id.trim()
      : typeof raw.projectId === "string"
        ? raw.projectId.trim()
        : "";
    const table = typeof raw.table === "string" ? raw.table.trim() : "";
    const requestedLimit = typeof raw.limit === "number" || typeof raw.limit === "string" ? Number(raw.limit) : undefined;

    if (!SUPABASE_READ_TOOL_NAMES.includes(tool)) continue;
    if (tool !== "list_projects" && (!projectId || ["unknown", "null", "n/a", "none"].includes(projectId.toLowerCase()))) continue;
    if ((tool === "describe_table" || tool === "read_rows") && !table) continue;
    if (table && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) continue;

    intents.push({
      tool,
      ...(projectId ? { projectId } : {}),
      ...(table ? { table } : {}),
      ...(readSafeColumns(raw.columns) ? { columns: readSafeColumns(raw.columns) } : {}),
      ...(typeof requestedLimit === "number" && Number.isFinite(requestedLimit)
        ? { limit: Math.max(1, Math.min(Math.floor(requestedLimit), 25)) }
        : {}),
    });
  }

  return intents;
}

export function stripSupabaseReadToolBlocks(content: string) {
  return content.replace(TOOL_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}
