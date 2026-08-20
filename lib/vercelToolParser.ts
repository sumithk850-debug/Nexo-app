export type VercelReadToolIntent =
  | { tool: "list_projects" }
  | { tool: "list_deployments"; projectId: string };

const TOOL_BLOCK = /<vercel-tool>\s*([\s\S]*?)\s*<\/vercel-tool>/gi;
const PROJECT_ID = /^[A-Za-z0-9_-]{1,160}$/;

export function parseVercelReadToolIntent(value: unknown): VercelReadToolIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const rawTool = typeof input.tool === "string"
    ? input.tool
    : typeof input.action === "string"
      ? input.action
      : "";

  if (rawTool === "list_projects") return { tool: "list_projects" };
  if (rawTool !== "list_deployments") return null;

  const projectId = typeof input.project_id === "string"
    ? input.project_id.trim()
    : typeof input.projectId === "string"
      ? input.projectId.trim()
      : "";
  if (!PROJECT_ID.test(projectId)) return null;
  return { tool: "list_deployments", projectId };
}

/**
 * Parses only the small, read-only Vercel tool vocabulary exposed to the chat.
 * Invalid model output is ignored rather than being forwarded to an API.
 */
export function parseVercelReadToolIntents(content: string): VercelReadToolIntent[] {
  const intents: VercelReadToolIntent[] = [];
  for (const match of content.matchAll(TOOL_BLOCK)) {
    try {
      const parsed = parseVercelReadToolIntent(JSON.parse(match[1]));
      if (parsed) intents.push(parsed);
    } catch {
      // Malformed blocks are ordinary model text, not executable instructions.
    }
  }
  return intents;
}

export function stripVercelReadToolBlocks(content: string): string {
  return content.replace(TOOL_BLOCK, "").replace(/\n{3,}/g, "\n\n");
}
