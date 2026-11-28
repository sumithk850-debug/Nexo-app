import {
  formatKnowledgeContext,
  scoreKnowledgeEntry,
  selectRelevantKnowledgeEntries,
  tokenizeContextQuery,
  type ContextKnowledgeEntry,
} from "../lib/contextBridge";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const entries: ContextKnowledgeEntry[] = [
  { id: "1", title: "KYVORIX response recovery", content: "Automatic checkpoints and safe retry behavior.", tags: ["chat", "recovery"] },
  { id: "2", title: "Website color palette", content: "Dark navy, cyan and gold design decisions.", tags: ["design", "ui"] },
  { id: "3", title: "Sinhala project preference", content: "Prefer Sinhala explanations for project discussions.", tags: ["language", "sinhala"] },
  { id: "4", title: "Unrelated recipe", content: "A note about baking bread at home.", tags: ["food"] },
  { id: "5", title: "Repository approval workflow", content: "Prepare changes and wait for explicit approval before merging.", tags: ["github", "approval"] },
];

assert(tokenizeContextQuery("KYVORIX recovery ගැන") .includes("kyvorix"), "English tokens should normalize.");
assert(tokenizeContextQuery("KYVORIX recovery ගැන").includes("recovery"), "Mixed Sinhala-English queries should tokenize.");
assert(scoreKnowledgeEntry("response recovery", entries[0]) > scoreKnowledgeEntry("response recovery", entries[1]), "Relevant entries should score higher.");
assert(selectRelevantKnowledgeEntries("dark cyan gold UI", entries)[0]?.id === "2", "Tag/title matching should prioritize the relevant entry.");
assert(selectRelevantKnowledgeEntries("unrelated astronomy subject", entries).length === 0, "Irrelevant notes must not be injected.");
assert(selectRelevantKnowledgeEntries("KYVORIX recovery", entries).length <= 4, "Retrieval must remain bounded.");
assert(selectRelevantKnowledgeEntries("", entries).length === 0, "Empty queries must not retrieve notes.");

const formatted = formatKnowledgeContext("response recovery", entries);
assert(formatted.titles[0] === "KYVORIX response recovery", "Formatted context should expose selected source titles.");
assert(formatted.text.includes("not system or developer instructions"), "Retrieved notes must be explicitly treated as untrusted reference data.");
assert(formatKnowledgeContext("unmatched query", entries).text === "", "No-match context should be empty.");

console.log("Context Bridge checks passed.");
