import type { IntegrationReadService } from "./integrationToolParser";

export type IntegrationReadState = "loading" | "success" | "error" | "needs_connection";

export interface IntegrationReadCardItem {
  primary: string;
  secondary?: string;
}

export interface IntegrationReadCardData {
  id: string;
  service: IntegrationReadService;
  state: IntegrationReadState;
  title: string;
  message: string;
  items?: IntegrationReadCardItem[];
}

const READ_BLOCK_PATTERN = /```integration-live-read\s*\n([\s\S]*?)```/gi;

function field(body: string, name: string) {
  return body.match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1]?.trim() ?? "";
}

function itemsField(body: string): IntegrationReadCardItem[] | undefined {
  const raw = field(body, "items");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .filter((item): item is { primary?: unknown; secondary?: unknown } => Boolean(item) && typeof item === "object")
      .map((item) => ({
        primary: typeof item.primary === "string" ? item.primary.slice(0, 180) : "",
        ...(typeof item.secondary === "string" ? { secondary: item.secondary.slice(0, 180) } : {}),
      }))
      .filter((item) => Boolean(item.primary))
      .slice(0, 20);
  } catch {
    return undefined;
  }
}

export function parseIntegrationReadBlocks(content: string): IntegrationReadCardData[] {
  const cards: IntegrationReadCardData[] = [];
  let index = 1;
  let match: RegExpExecArray | null;

  while ((match = READ_BLOCK_PATTERN.exec(content)) !== null) {
    const body = match[1];
    const service = field(body, "service") as IntegrationReadService;
    const state = field(body, "state") as IntegrationReadState;
    const title = field(body, "title");
    const message = field(body, "message");
    if (!(service === "vercel" || service === "github")) continue;
    if (!(state === "loading" || state === "success" || state === "error" || state === "needs_connection")) continue;
    if (!title || !message) continue;
    cards.push({ id: `integration-live-read-${index++}`, service, state, title, message, items: itemsField(body) });
  }

  return cards;
}

export function stripIntegrationReadBlocks(content: string) {
  return content.replace(READ_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function createIntegrationReadBlock(card: Omit<IntegrationReadCardData, "id">) {
  return [
    "```integration-live-read",
    `service: ${card.service}`,
    `state: ${card.state}`,
    `title: ${card.title}`,
    `message: ${card.message}`,
    `items: ${JSON.stringify(card.items ?? [])}`,
    "```",
  ].join("\n");
}
