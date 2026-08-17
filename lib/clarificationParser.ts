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

function parseHeaderValue(line: string, key: string) {
  const match = line.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, "i"));
  return match?.[1]?.trim() ?? "";
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

  return cards;
}

export function stripClarificationBlocks(content: string) {
  return content.replace(CLARIFICATION_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}
