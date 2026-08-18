export interface ClarificationOption {
  id: string;
  label: string;
  description?: string;
}

export interface ClarificationCardData {
  id: string;
  question: string;
  options: ClarificationOption[];
  allowCustomInput?: boolean;
}

const CLARIFICATION_BLOCK_PATTERN = /```clarification-card\s*\n([\s\S]*?)```/gi;
const PLAIN_BOARD_HEADING = /(?:pick|choose|select)\s+(?:an?\s+)?option|option\s*(?:board|choices?)|විකල්ප(?:යක්|යන්)?\s*(?:තෝරන්න|තෝරන්නෙ|තෝරාගන්න)|ඔප්ෂන්\s*(?:තෝරන්න|තෝරාගන්න)/i;
const NUMBERED_OPTION = /^\s*(?:\d+[.)]|[-*])\s+(.+)$/;

function parseHeaderValue(line: string, key: string) {
  const match = line.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function parsePlainOptionBoard(content: string): ClarificationCardData[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const headingIndex = lines.findIndex((line) => PLAIN_BOARD_HEADING.test(line));
  if (headingIndex < 0) return [];

  const options: ClarificationOption[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(NUMBERED_OPTION);
    if (!match) continue;
    const label = match[1].replace(/^[-–—\s]+/, "").trim();
    if (label.length >= 3 && label.length <= 180) {
      options.push({ id: `option-${options.length + 1}`, label });
    }
  }
  if (options.length < 2 || options.length > 6) return [];

  const question = [...lines.slice(0, headingIndex)].reverse().find((line) => line.trim().length > 0)?.trim()
    || "Which option should I use to continue?";
  return [{ id: "clarification-fallback-1", question, options, allowCustomInput: true }];
}

export function parseClarificationBlocks(content: string): ClarificationCardData[] {
  const cards: ClarificationCardData[] = [];
  let match: RegExpExecArray | null;
  let index = 1;

  while ((match = CLARIFICATION_BLOCK_PATTERN.exec(content)) !== null) {
    const lines = match[1].replace(/\r/g, "").split("\n");
    const question = parseHeaderValue(lines.join("\n"), "question") || "Please clarify your preference to continue:";
    
    const options: ClarificationOption[] = [];
    let parsingOptions = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^options\s*:/i.test(trimmed)) {
        parsingOptions = true;
        continue;
      }
      if (parsingOptions) {
        if (!trimmed || /^[a-z_]+\s*:/i.test(trimmed)) {
          parsingOptions = false;
        } else {
          const optMatch = trimmed.match(/^-\s*\[([a-z0-9_-]+)\]\s*(.*)$/i) || trimmed.match(/^-\s*(.*)$/);
          if (optMatch) {
            const optId = optMatch[1] ? optMatch[1].trim() : `opt-${options.length + 1}`;
            const optLabel = optMatch[2] ? optMatch[2].trim() : optMatch[1].trim();
            options.push({ id: optId, label: optLabel });
          }
        }
      }
    }

    if (options.length === 0) {
      options.push(
        { id: "option-a", label: "Proceed with standard default approach" },
        { id: "option-b", label: "Request detailed step-by-step breakdown" }
      );
    }

    cards.push({
      id: `clarification-${index++}`,
      question,
      options,
      allowCustomInput: true,
    });
  }

  return cards.length > 0 ? cards : parsePlainOptionBoard(content);
}

export function stripClarificationBlocks(content: string) {
  const structured = content.replace(CLARIFICATION_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
  if (structured !== content.trim() || parsePlainOptionBoard(content).length === 0) return structured;
  const lines = content.replace(/\r/g, "").split("\n");
  const headingIndex = lines.findIndex((line) => PLAIN_BOARD_HEADING.test(line));
  return lines.slice(0, Math.max(headingIndex, 0)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
