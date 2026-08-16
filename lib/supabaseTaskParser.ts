export type SupabaseTaskOperation =
  | "inspect"
  | "query"
  | "create_table"
  | "alter_table"
  | "insert"
  | "update"
  | "delete"
  | "sql";

export interface SupabaseTask {
  id: string;
  operation: SupabaseTaskOperation;
  projectId: string | null;
  table: string | null;
  sql: string;
}

const TASK_BLOCK_PATTERN = /```supabase-task\s*\n([\s\S]*?)(?:```|$)/gi;
const OPERATIONS = new Set<SupabaseTaskOperation>([
  "inspect",
  "query",
  "create_table",
  "alter_table",
  "insert",
  "update",
  "delete",
  "sql",
]);

function parseHeaderValue(line: string, key: string) {
  const match = line.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, "i"));
  return match?.[1]?.trim() ?? "";
}

export function parseSupabaseTaskBlocks(content: string): SupabaseTask[] {
  const tasks: SupabaseTask[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = TASK_BLOCK_PATTERN.exec(content)) !== null) {
    const lines = match[1].replace(/\r/g, "").split("\n");
    const sqlLine = lines.findIndex((line) => /^sql\s*:\s*$/i.test(line.trim()));
    const operationValue = parseHeaderValue(lines.join("\n"), "operation").toLowerCase() as SupabaseTaskOperation;
    const operation = OPERATIONS.has(operationValue) ? operationValue : "sql";
    const sql = sqlLine >= 0 ? lines.slice(sqlLine + 1).join("\n").trim() : parseHeaderValue(lines.join("\n"), "sql");
    if (!sql) continue;

    tasks.push({
      id: `supabase-task-${index++}`,
      operation,
      projectId: parseHeaderValue(lines.join("\n"), "project_id") || null,
      table: parseHeaderValue(lines.join("\n"), "table") || null,
      sql,
    });
  }

  return tasks;
}

export function stripSupabaseTaskBlocks(content: string) {
  return content.replace(TASK_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}
