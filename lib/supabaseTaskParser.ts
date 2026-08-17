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

const TASK_BLOCK_PATTERN = /```supabase-task\s*\n([\s\S]*?)```/gi;
const MALFORMED_TASK_PATTERN = /```supabase-task[^\n`]*\n[\s\S]*?(?:```|$)/gi;
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

const PLACEHOLDER_VALUES = new Set(["", "unknown", "null", "n/a", "none", "not selected"]);

function normalizeReference(value: string) {
  const normalized = value.trim();
  return PLACEHOLDER_VALUES.has(normalized.toLowerCase()) ? null : normalized;
}

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
    const body = lines.join("\n");
    const operationValue = parseHeaderValue(body, "operation").toLowerCase() as SupabaseTaskOperation;
    const operation = OPERATIONS.has(operationValue) ? operationValue : "sql";
    const sql = sqlLine >= 0 ? lines.slice(sqlLine + 1).join("\n").trim() : parseHeaderValue(body, "sql");
    if (!sql) continue;

    const projectId = normalizeReference(parseHeaderValue(body, "project_id"));
    const table = normalizeReference(parseHeaderValue(body, "table"));
    // A model must never turn missing project context into a card. Ignore the
    // malformed block entirely; its normal-language response can ask the user
    // to select a verified project instead.
    if (!projectId) continue;

    tasks.push({
      id: `supabase-task-${index++}`,
      operation,
      projectId,
      table,
      sql,
    });
  }

  return tasks;
}

export function stripSupabaseTaskBlocks(content: string) {
  const withoutValidTasks = content.replace(TASK_BLOCK_PATTERN, "");
  return withoutValidTasks
    .replace(
      MALFORMED_TASK_PATTERN,
      "\n\n> Supabase task details could not be verified. Select a project in Integrations and try again.\n\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
