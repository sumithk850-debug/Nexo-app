import { parseClarificationBlocks, stripClarificationBlocks } from "./clarificationParser";

export function testClarificationParser() {
  const sample = "Hello\n```clarification-card\nquestion: Which database would you like to use?\noptions:\n- [pg] PostgreSQL\n- [mysql] MySQL\n```\nWorld";
  const cards = parseClarificationBlocks(sample);
  const clean = stripClarificationBlocks(sample);
  return { cardsCount: cards.length, firstQuestion: cards[0]?.question, clean };
}
