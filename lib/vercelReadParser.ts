export type VercelReadCardState = "loading" | "success" | "needs_connection" | "error";

export interface VercelProjectSummary {
  id: string;
  name: string;
  framework: string | null;
  productionUrl: string | null;
  scopeLabel: string | null;
}

export interface VercelDeploymentSummary {
  id: string;
  url: string | null;
  readyState: string | null;
  createdAt: number | null;
  isProduction: boolean;
}

export interface VercelReadCardData {
  id: string;
  state: VercelReadCardState;
  kind: "projects" | "deployments";
  title: string;
  message: string;
  projectId?: string;
  projects?: VercelProjectSummary[];
  deployments?: VercelDeploymentSummary[];
}

const CARD_BLOCK = /```vercel-live-read\s*\n([\s\S]*?)```/gi;

function asProject(value: unknown): VercelProjectSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.name !== "string") return null;
  const rawScope = item.scope;
  const scopeLabelCandidate = rawScope && typeof rawScope === "object" && !Array.isArray(rawScope)
    ? (rawScope as Record<string, unknown>).label
    : null;
  const scopeLabel = typeof scopeLabelCandidate === "string" ? scopeLabelCandidate : null;
  return {
    id: item.id,
    name: item.name,
    framework: typeof item.framework === "string" ? item.framework : null,
    productionUrl: typeof item.productionUrl === "string" ? item.productionUrl : null,
    scopeLabel,
  };
}

function asDeployment(value: unknown): VercelDeploymentSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string") return null;
  return {
    id: item.id,
    url: typeof item.url === "string" ? item.url : null,
    readyState: typeof item.readyState === "string" ? item.readyState : null,
    createdAt: typeof item.createdAt === "number" ? item.createdAt : null,
    isProduction: item.isProduction === true,
  };
}

function parseCard(value: unknown): VercelReadCardData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const state = item.state;
  const kind = item.kind;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.message !== "string" ||
    (state !== "loading" && state !== "success" && state !== "needs_connection" && state !== "error") ||
    (kind !== "projects" && kind !== "deployments")
  ) return null;

  return {
    id: item.id,
    state,
    kind,
    title: item.title,
    message: item.message,
    projectId: typeof item.projectId === "string" ? item.projectId : undefined,
    projects: Array.isArray(item.projects) ? item.projects.map(asProject).filter((item): item is VercelProjectSummary => item !== null).slice(0, 50) : undefined,
    deployments: Array.isArray(item.deployments) ? item.deployments.map(asDeployment).filter((item): item is VercelDeploymentSummary => item !== null).slice(0, 25) : undefined,
  };
}

export function parseVercelReadBlocks(content: string): VercelReadCardData[] {
  const cards: VercelReadCardData[] = [];
  for (const match of content.matchAll(CARD_BLOCK)) {
    try {
      const card = parseCard(JSON.parse(match[1]));
      if (card) cards.push(card);
    } catch {
      // Invalid card blocks are ignored and remain non-executable text.
    }
  }
  return cards;
}

export function stripVercelReadBlocks(content: string): string {
  return content.replace(CARD_BLOCK, "").replace(/\n{3,}/g, "\n\n");
}

export function createVercelReadBlock(card: Omit<VercelReadCardData, "id">): string {
  return `\`\`\`vercel-live-read\n${JSON.stringify({ id: crypto.randomUUID(), ...card })}\n\`\`\``;
}
