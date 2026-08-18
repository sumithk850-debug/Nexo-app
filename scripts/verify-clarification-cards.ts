import assert from "node:assert/strict";

import { parseClarificationBlocks, stripClarificationBlocks } from "../lib/clarificationParser";

const structured = [
  "I need one choice before continuing.",
  "```clarification-card",
  "question: Which deployment target should I use?",
  "options:",
  "- [preview] Preview environment",
  "- [production] Production environment",
  "```",
].join("\n");

const structuredCards = parseClarificationBlocks(structured);
assert.equal(structuredCards.length, 1, "the required structured contract must create one card");
assert.equal(structuredCards[0]?.question, "Which deployment target should I use?");
assert.deepEqual(structuredCards[0]?.options.map((option) => option.id), ["preview", "production"]);
assert.equal(stripClarificationBlocks(structured), "I need one choice before continuing.");

const screenshotStylePlainText = [
  "කරුණාකර ඔබට අවශ්‍ය දේ අනුව මට කියන්න:",
  "🚀 Pick an Option (තෝරගන්න)",
  "1. 🔍 Image විශ්ලේෂණය (Visual Analysis)",
  "2. 💻 Code සමීක්ෂණය (Code Integration)",
  "3. 🛠️ Supabase දත්ත පරීක්ෂාව (Database Query)",
].join("\n");

assert.equal(
  parseClarificationBlocks(screenshotStylePlainText).length,
  0,
  "generic option menus must remain normal chat content rather than an interactive card",
);
assert.equal(
  stripClarificationBlocks(screenshotStylePlainText),
  screenshotStylePlainText,
  "generic option menus must not be hidden from the transcript",
);

assert.equal(parseClarificationBlocks("1. Normal implementation step\n2. Another normal step").length, 0);

console.log("Clarification card checks passed: explicit cards render, ordinary lists remain normal Markdown.");
