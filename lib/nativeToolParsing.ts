export interface ParsedNativeToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  validArguments: boolean;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export function parseOpenRouterToolCalls(payload: unknown): ParsedNativeToolCall[] {
  const calls = (payload as { choices?: Array<{ message?: { tool_calls?: unknown[] } }> } | null)?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.slice(0, 3).flatMap((raw) => {
    if (!isRecord(raw) || !isRecord(raw.function)) return [];
    const name = typeof raw.function.name === "string" ? raw.function.name.trim().slice(0, 100) : "";
    if (!name) return [];
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 120) : "tool-" + name;
    try {
      const parsed = typeof raw.function.arguments === "string" ? JSON.parse(raw.function.arguments) as unknown : raw.function.arguments;
      return [{ id, name, args: isRecord(parsed) ? parsed : {}, validArguments: isRecord(parsed) }];
    } catch {
      return [{ id, name, args: {}, validArguments: false }];
    }
  });
}
export function parseGeminiToolCalls(payload: unknown): ParsedNativeToolCall[] {
  const parts = (payload as { candidates?: Array<{ content?: { parts?: unknown[] } }> } | null)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return [];
  return parts.filter((part) => isRecord(part) && isRecord(part.functionCall) && typeof part.functionCall.name === "string")
    .slice(0, 3).map((part, index) => {
      const call = (part as { functionCall: { name: string; args?: unknown } }).functionCall;
      const validArguments = call.args === undefined || isRecord(call.args);
      return { id: "gemini-tool-" + (index + 1), name: call.name.trim().slice(0, 100), args: isRecord(call.args) ? call.args : {}, validArguments };
    }).filter((call) => call.name.length > 0);
}
export function isReadableWebPageResult(content: string): boolean {
  const normalized = content.trim();
  return normalized.length > 0 && !/\(Could not read this link:/i.test(normalized);
}

/**
 * Identify requests that should not be answered until a matching read-only
 * tool has actually been called. Attached-file tasks use their separate
 * prepared attachment context and must not be routed to the GitHub reader.
 */
export function requiresNativeToolCall(text: string, availableToolNames: string[]): boolean {
  const value = text.trim().toLocaleLowerCase("en-US");
  if (!value || /\[attached files prepared\]/i.test(value)) return false;
  const available = new Set(availableToolNames);
  const hasAny = (...names: string[]) => names.some((name) => available.has(name));

  const webIntent = /https?:\/\/|\b(read|open|summari[sz]e|analy[sz]e) (this )?(url|website|webpage|page)\b|වෙබ් අඩවිය|වෙබ් පිටුව/i.test(value);
  if (webIntent && hasAny("web_fetch_url")) return true;

  const readAction = /\b(read|open|inspect|review|list|show|fetch|check|describe|query|view|look up|search|find)\b/i;
  const githubTarget = /\b(github|repository|repo|codebase|file path|files?)\b/i;
  const githubIntent = (githubTarget.test(value) && readAction.test(value)) ||
    (/\b(read|open|inspect|review|list|show|fetch|check)\b.{0,60}\b(file|files|repository|repo|codebase)\b/i.test(value)) ||
    (/\b(file|files|repository|repo|codebase)\b.{0,60}\b(read|open|inspect|review|list|show|fetch|check)\b/i.test(value)) ||
    (/(ගිතුබ්|රෙපෝ|රිපොසිටරි|ගොනුව|ෆයිල්)/i.test(value) && /(කියව|බලන්න|පරීක්ෂා|ලැයිස්තු)/i.test(value));
  if (githubIntent && hasAny("github_read_file", "github_list_files")) return true;

  const supabaseIntent = /\b(supabase|database|schema|tables?|columns?|rows?)\b/i.test(value) && readAction.test(value) ||
    /(සුපබේස්|දත්ත සමුදා|ඩේටාබේස්|ටේබල්|ස්කීමා)/i.test(value) && /(කියව|බලන්න|පරීක්ෂා|ලැයිස්තු|විස්තර)/i.test(value);
  if (supabaseIntent && hasAny("supabase_list_projects", "supabase_list_tables", "supabase_describe_table", "supabase_read_rows")) return true;

  const vercelIntent = /\bvercel\b/i.test(value) && /\b(check|list|show|inspect|get|view|fetch|read)\b/i.test(value) ||
    /වර්සල්/i.test(value) && /(බලන්න|පරීක්ෂා|ලැයිස්තු|කියව)/i.test(value);
  if (vercelIntent && hasAny("vercel_list_projects", "vercel_list_deployments")) return true;

  const wikipediaIntent = /\b(search|look up|find|read|open)\b.{0,40}\b(wikipedia|encyclopedia|wiki article)\b|\b(wikipedia|encyclopedia|wiki article)\b.{0,40}\b(search|look up|find|read|open)\b|විකිපීඩියා/i.test(value) &&
    /\b(search|look up|find|read|open)\b|විකිපීඩියා/i.test(value);
  return wikipediaIntent && hasAny("wikipedia_search");
}
