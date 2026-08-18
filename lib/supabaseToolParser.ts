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

const TOOL_BLOCK_PATTERN = /```supabase-tool\s*\n([\s\S]*?)```/gi;

function field(body: string, name: string) {
  return body.match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1]?.trim() ?? "";
}

function readColumns(body: string) {
  const raw = field(body, "columns");
  if (!raw) return undefined;
  try {
    const columns = JSON.parse(raw);
    return Array.isArray(columns)
      ? columns.filter((column): column is string => typeof column === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)).slice(0, 12)
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseSupabaseReadToolIntents(content: string): SupabaseReadToolIntent[] {
  const intents: SupabaseReadToolIntent[] = [];
  let match: RegExpExecArray | null;

  while ((match = TOOL_BLOCK_PATTERN.exec(content)) !== null) {
    const body = match[1];
    const tool = field(body, "tool") as SupabaseReadToolName;
    const projectId = field(body, "project_id");
    const table = field(body, "table");
    const rawLimit = field(body, "limit");
    const requestedLimit = rawLimit ? Number(rawLimit) : undefined;

    if (!SUPABASE_READ_TOOL_NAMES.includes(tool)) continue;
    if (tool !== "list_projects" && (!projectId || ["unknown", "null", "n/a", "none"].includes(projectId.toLowerCase()))) continue;
    if ((tool === "describe_table" || tool === "read_rows") && !table) continue;
    if (table && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) continue;

    intents.push({
      tool,
      projectId: projectId || undefined,
      ...(table ? { table } : {}),
      ...(readColumns(body) ? { columns: readColumns(body) } : {}),
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
