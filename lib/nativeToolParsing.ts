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
