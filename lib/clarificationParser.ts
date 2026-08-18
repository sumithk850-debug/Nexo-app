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

// Only an explicit model-generated card may become interactive UI. Ordinary
// prose, numbered steps, and recommendation lists must remain visible as a
// normal detailed answer.
const CLARIFICATION_BLOCK_PATTERN = /```clarification-card\s*\n([\s\S]*?)```/gi;

function parseHeaderValue(line: string, key: string) {
  const match = line.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

export function parseClarificationBlocks(content: string): ClarificationCardData[] {
  const cards: ClarificationCardData[] = [];
  let match: RegExpExecArray | null;
  let index = 1;

  while ((match = CLARIFICATION_BLOCK_PATTERN.exec(content)) !== null) {
    const lines = match[1].replace(/\r/g, "").split("\n");
    const question = parseHeaderValue(lines.join("\n"), "question");
    if (!question) continue;

    const options: ClarificationOption[] = [];
    let parsingOptions = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^options\s*:/i.test(trimmed)) {
        parsingOptions = true;
        continue;
      }
      if (!parsingOptions) continue;
      if (!trimmed || /^[a-z_]+\s*:/i.test(trimmed)) {
        parsingOptions = false;
        continue;
      }

      const optionMatch = trimmed.match(/^\-\s*\[([a-z0-9_-]+)\]\s*(.+)$/i);
      if (optionMatch) {
        options.push({ id: optionMatch[1].trim(), label: optionMatch[2].trim() });
      }
    }

    // A valid card needs a concrete question and at least two real choices.
    // Invalid or generic blocks stay in the visible chat transcript as prose.
    if (options.length < 2 || options.length > 5) continue;

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
