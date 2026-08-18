export type SupabaseReadState = "loading" | "success" | "error" | "needs_project";

export interface SupabaseReadCardData {
  id: string;
  state: SupabaseReadState;
  kind: "projects" | "schema" | "columns";
  projectId?: string;
  title: string;
  message: string;
  tableNames?: string[];
  policyCount?: number;
  columns?: Array<{ name: string; type: string | null; nullable: boolean }>;
}

const READ_BLOCK_PATTERN = /```supabase-live-read\s*\n([\s\S]*?)```/gi;

function field(body: string, name: string) {
  return body.match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1]?.trim() ?? "";
}

function jsonField<T>(body: string, name: string): T | undefined {
  const raw = field(body, name);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function parseSupabaseReadBlocks(content: string): SupabaseReadCardData[] {
  const cards: SupabaseReadCardData[] = [];
  let match: RegExpExecArray | null;
  let index = 1;

  while ((match = READ_BLOCK_PATTERN.exec(content)) !== null) {
    const body = match[1];
    const state = field(body, "state") as SupabaseReadState;
    const kind = field(body, "kind") as SupabaseReadCardData["kind"];
    const title = field(body, "title");
    const message = field(body, "message");

    if (!(["loading", "success", "error", "needs_project"] as string[]).includes(state)) continue;
    if (!(["projects", "schema", "columns"] as string[]).includes(kind)) continue;
    if (!title || !message) continue;

    const tableNames = jsonField<string[]>(body, "tables")?.filter((table) => typeof table === "string");
    const columns = jsonField<Array<{ name: string; type: string | null; nullable: boolean }>>(body, "columns")
      ?.filter((column) => Boolean(column?.name));
    const rawPolicyCount = Number(field(body, "policy_count"));

    cards.push({
      id: `supabase-live-read-${index++}`,
      state,
      kind,
      projectId: field(body, "project_id") || undefined,
      title,
      message,
      tableNames,
      columns,
      policyCount: Number.isFinite(rawPolicyCount) ? rawPolicyCount : undefined,
    });
  }

  return cards;
}

export function stripSupabaseReadBlocks(content: string) {
  return content.replace(READ_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function createSupabaseReadBlock(card: Omit<SupabaseReadCardData, "id">) {
  return [
    "```supabase-live-read",
    `state: ${card.state}`,
    `kind: ${card.kind}`,
    `project_id: ${card.projectId ?? ""}`,
    `title: ${card.title}`,
    `message: ${card.message}`,
    `tables: ${JSON.stringify(card.tableNames ?? [])}`,
    `columns: ${JSON.stringify(card.columns ?? [])}`,
    `policy_count: ${card.policyCount ?? 0}`,
    "```",
  ].join("\n");
}
