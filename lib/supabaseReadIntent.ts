import type { SupabaseReadToolIntent } from "./supabaseToolParser";

const PLACEHOLDER_PROJECT_IDS = new Set(["unknown", "null", "n/a", "none"]);

function selectedProjectId(value: string | null | undefined) {
  const projectId = value?.trim() ?? "";
  return /^[a-zA-Z0-9_-]{8,}$/.test(projectId) && !PLACEHOLDER_PROJECT_IDS.has(projectId.toLowerCase())
    ? projectId
    : "";
}

function requestedTableName(message: string) {
  return (
    message.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:table|ටේබල්)\b/i)?.[1]
    ?? message.match(/(?:table|ටේබල්)\s+(?:named\s+)?[`'" ]*([a-zA-Z_][a-zA-Z0-9_]*)/i)?.[1]
    ?? ""
  ).trim();
}

/**
 * Chooses only safe, user-scoped, read-only Supabase actions. Mutations and
 * ambiguous requests intentionally return undefined so they stay in the
 * approval/clarification flow instead of being automatically executed.
 */
export function deriveSupabaseReadIntent(
  latestUserText: string,
  recentConversationText: string,
  projectId: string | null | undefined,
): SupabaseReadToolIntent | undefined {
  const hasExplicitSupabaseIntent = /supabase|database|schema|table|sql|ඩේටා|දත්ත|ටේබල්/i.test(latestUserText);
  const isSupabaseProjectFollowUp =
    /project|projects|ප්‍ර[ො]?ජෙක්ට්/i.test(latestUserText)
    && /supabase|database|schema|table|sql|ඩේටා|දත්ත|ටේබල්/i.test(recentConversationText);
  if (!hasExplicitSupabaseIntent && !isSupabaseProjectFollowUp) return undefined;

  const requestsProjectList = /(?:\b(?:list|show|view|display|active|connected|available)\b[\s\S]{0,40}\bprojects?\b|\bprojects?\s+(?:list|available)\b|(?:ප්‍ර[ො]?ජෙක්ට්|project)[\s\S]{0,24}(?:ලැයිස්තුව|බලන්න|පෙන්වන්න)|(?:සම්බන්ධිත|සක්‍රිය)[\s\S]{0,24}ප්‍ර[ො]?ජෙක්ට්)/i.test(latestUserText);
  if (requestsProjectList) return { tool: "list_projects" };

  const safeProjectId = selectedProjectId(projectId);
  if (!safeProjectId) return undefined;

  const table = requestedTableName(latestUserText);
  const isSafeTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table);
  const requestsTableList = /(?:\b(?:list|show|view|display)\b[\s\S]{0,32}\btables?\b|(?:ටේබල්|tables?)[\s\S]{0,24}(?:ලැයිස්තුව|බලන්න|පෙන්වන්න))/i.test(latestUserText) && !isSafeTable;
  if (requestsTableList) return { tool: "list_tables", projectId: safeProjectId };

  const requestsTableDescription = isSafeTable && /(?:schema|column|field|structure|detail|definition|කොලම්|ව්‍යුහ|විස්තර|කියව|බලන්න|පෙන්වන්න)/i.test(latestUserText);
  if (requestsTableDescription) return { tool: "describe_table", projectId: safeProjectId, table };

  return undefined;
}
