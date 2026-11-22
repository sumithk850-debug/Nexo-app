import type { ActionEvent, ActionPhase } from "@/lib/actionEngine";

const TOOL_LABELS: Record<string, string> = {
  web_fetch_url: "Web page",
  wikipedia_search: "Wikipedia search",
  github_list_files: "GitHub list files",
  github_read_file: "GitHub read file",
  supabase_list_projects: "Supabase list projects",
  supabase_list_tables: "Supabase list tables",
  supabase_describe_table: "Supabase inspect table",
  supabase_read_rows: "Supabase read rows",
  vercel_list_projects: "Vercel list projects",
  vercel_list_deployments: "Vercel list deployments",
};

export function getToolDisplayLabel(operation: string): string {
  return TOOL_LABELS[operation] ?? operation.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getToolCallLabel(operation: string): string {
  return `call-tool (${getToolDisplayLabel(operation)})`;
}

export function getActionStatusLabel(phase: ActionPhase): string {
  if (phase === "running") return "calling";
  if (phase === "verifying") return "checking result";
  if (phase === "succeeded") return "verified";
  if (phase === "failed" || phase === "cancelled") return "failed";
  if (phase === "needs_approval") return "approval required";
  if (phase === "needs_connection") return "connection required";
  return "queued";
}

export function latestActionEvents(events: readonly ActionEvent[]): ActionEvent[] {
  const latest = new Map<string, ActionEvent>();
  for (const event of events) {
    const previous = latest.get(event.actionId);
    if (!previous || event.createdAt >= previous.createdAt) latest.set(event.actionId, event);
  }
  return [...latest.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function createToolCallStreamMarker(events: readonly ActionEvent[]): string {
  return `<kyvorix-action>${JSON.stringify(events.slice(0, 12))}</kyvorix-action>`;
}

export function consumeToolCallStreamMarkers(text: string): {
  content: string;
  events: ActionEvent[];
  pending: string;
} {
  const events: ActionEvent[] = [];
  let working = text;
  const start = working.lastIndexOf("<kyvorix-action>");
  if (start >= 0 && working.indexOf("</kyvorix-action>", start) < 0) {
    const pending = working.slice(start);
    working = working.slice(0, start);
    const parsedContent = consumeToolCallStreamMarkers(working);
    return { content: parsedContent.content, events: parsedContent.events, pending };
  }
  const content = working.replace(/<kyvorix-action>([\s\S]*?)<\/kyvorix-action>/g, (_match, raw: string) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const event of parsed) {
          if (
            event && typeof event === "object" &&
            typeof event.id === "string" && typeof event.actionId === "string" &&
            typeof event.operation === "string" && typeof event.phase === "string" &&
            typeof event.summary === "string"
          ) events.push(event as ActionEvent);
        }
      }
    } catch {
      // Malformed markers are removed and never become assistant-visible content.
    }
    return "";
  });
  return { content, events, pending: "" };
}
