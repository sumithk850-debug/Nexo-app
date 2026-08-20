export const INTEGRATION_READ_SERVICES = ["vercel", "github"] as const;
export type IntegrationReadService = (typeof INTEGRATION_READ_SERVICES)[number];

export const INTEGRATION_READ_ACTIONS = {
  vercel: ["list_projects", "list_deployments"],
  github: ["list_repositories", "selected_repository"],
} as const;

export type IntegrationReadAction =
  | (typeof INTEGRATION_READ_ACTIONS.vercel)[number]
  | (typeof INTEGRATION_READ_ACTIONS.github)[number];

export interface IntegrationReadToolIntent {
  service: IntegrationReadService;
  action: IntegrationReadAction;
}

const TOOL_BLOCK_PATTERN = /<integration-tool>\s*([\s\S]*?)\s*<\/integration-tool>/gi;

function supportsAction(service: IntegrationReadService, action: string): action is IntegrationReadAction {
  return (INTEGRATION_READ_ACTIONS[service] as readonly string[]).includes(action);
}

/**
 * Parses only the four read-only integration intents supported by the existing
 * first-party Vercel and GitHub endpoints. Anything else is ignored rather
 * than becoming a network call or an implied write.
 */
export function parseIntegrationReadToolIntents(content: string): IntegrationReadToolIntent[] {
  const intents: IntegrationReadToolIntent[] = [];
  let match: RegExpExecArray | null;

  while ((match = TOOL_BLOCK_PATTERN.exec(content)) !== null) {
    try {
      const raw = JSON.parse(match[1]) as { service?: unknown; action?: unknown };
      if (typeof raw.service !== "string" || typeof raw.action !== "string") continue;
      if (!INTEGRATION_READ_SERVICES.includes(raw.service as IntegrationReadService)) continue;
      const service = raw.service as IntegrationReadService;
      if (!supportsAction(service, raw.action)) continue;
      intents.push({ service, action: raw.action });
    } catch {
      // A malformed model block is ordinary text, not a tool request.
    }
  }

  return intents;
}

export function stripIntegrationReadToolBlocks(content: string) {
  return content.replace(TOOL_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}
