import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MAX_AUTO_FILES,
  chooseAutoFiles,
  isRepositoryQuestion,
  summarizeTree,
} from "../lib/githubRepoHeuristics";

const read = (path: string) => readFileSync(path, "utf8");

// -------------------------------------------------------------------------
// 1. Which messages are about the user's connected repository?
// -------------------------------------------------------------------------
for (const yes of [
  "What is in my repo?",
  "explain my codebase to me",
  "Read the README and summarize it",
  "show the project structure",
  "list my latest commits",
  "Which branch am I on?",
  "can you look at my github",
  "How does the backend of my app work? Use my project",
  "මගේ ගිතුබ් එකේ තියෙන ෆයිල් බලන්න",
  "මගේ රෙපෝ එක කියවලා මොකක්ද කරන්නේ කියන්න",
  "මගේ ප්‍රොජෙක්ට් එකේ ගැටලුව හොයන්න",
]) {
  assert.equal(isRepositoryQuestion(yes), true, `Should be a repository question: ${yes}`);
}
for (const no of [
  "review my essay about climate change",
  "fix this bug in my python function",
  "what files do I need for a passport application?",
  "hello",
  "write a file reader in python",
  "What is the capital of France?",
  "ඔබට කොහොමද?",
  "",
]) {
  assert.equal(isRepositoryQuestion(no), false, `Must not trigger repository reads: ${no}`);
}

// -------------------------------------------------------------------------
// 2. Which files are read when none is named?
// -------------------------------------------------------------------------
const nextTree = [
  "README.md", "package.json", "package-lock.json", "next.config.mjs", "tsconfig.json", ".gitignore",
  "app/page.tsx", "app/layout.tsx", "app/api/chat/route.ts", "app/api/usage/route.ts",
  "components/MessageBubble.tsx", "components/ChatInput.tsx", "lib/providers.server.ts", "lib/urlReader.server.ts",
  "public/logo.png", "public/icon.svg", "node_modules/react/index.js", ".next/server/app.js", "docs/README.md",
];
const generic = chooseAutoFiles("what is in my repo? explain it", nextTree);
assert.deepEqual(generic.slice(0, 2), ["README.md", "package.json"], "Orientation files come first, shallowest first");
assert.ok(generic.length <= MAX_AUTO_FILES);
assert.ok(generic.every((path) => nextTree.includes(path)), "Only paths that really exist are chosen");
assert.ok(generic.every((path) => !/node_modules|\.next\/|package-lock|\.png|\.svg/.test(path)), "Dependencies, build output, lockfiles and images are never read");
assert.equal(new Set(generic).size, generic.length, "No duplicates");

const chatQuestion = chooseAutoFiles("explain how the chat route works in my project", nextTree);
assert.ok(chatQuestion.includes("app/api/chat/route.ts"), "Files whose path matches the question are included");
assert.ok(chatQuestion.indexOf("README.md") < chatQuestion.indexOf("app/api/chat/route.ts"), "Orientation files stay first");
const urlQuestion = chooseAutoFiles("how does the urlReader in my repo block private addresses", nextTree);
assert.ok(urlQuestion.includes("lib/urlReader.server.ts"), "A file name mentioned in a different case still matches");

const pythonTree = ["README.rst", "pyproject.toml", "requirements.txt", "src/app/main.py", "tests/test_main.py"];
assert.deepEqual(chooseAutoFiles("explain my repo", pythonTree).slice(0, 3), ["README.rst", "pyproject.toml", "requirements.txt"]);
assert.deepEqual(chooseAutoFiles("explain my repo", []), [], "An empty repository selects nothing");
assert.deepEqual(chooseAutoFiles("explain my repo", ["node_modules/x/index.js", "dist/app.js"]), [], "Only skipped paths selects nothing");

// -------------------------------------------------------------------------
// 3. Large repositories still give the assistant a usable map.
// -------------------------------------------------------------------------
assert.equal(summarizeTree(["a.ts", "b/c.ts"]), "a.ts\nb/c.ts");
const big = Array.from({ length: 450 }, (_, index) => (index % 3 === 0 ? `src/file${index}.ts` : index % 3 === 1 ? `docs/page${index}.md` : `root${index}.json`));
const summary = summarizeTree(big);
assert.match(summary, /TOP-LEVEL LAYOUT:/);
assert.match(summary, /src\/ — 150 files/);
assert.match(summary, /docs\/ — 150 files/);
assert.match(summary, /150 more files not shown/);
assert.ok(summary.includes("src/file0.ts"));

// -------------------------------------------------------------------------
// 4. Wiring: the assistant is told the truth about the connection and can really read.
// -------------------------------------------------------------------------
const context = read("lib/githubContext.server.ts");
const native = read("lib/nativeTools.server.ts");
assert.match(context, /GITHUB IS NOT CONNECTED for this user/, "A user without GitHub is told plainly how to connect");
assert.match(context, /GITHUB IS CONNECTED.*but NO REPOSITORY IS SELECTED/, "A connected account without a selected repository is described accurately");
assert.match(context, /const autoSelected = namedPaths\.length === 0 && isRepositoryQuestion\(latestUserMessage\)/, "Key files are read automatically for repository questions");
assert.match(context, /chooseAutoFiles\(latestUserMessage, treePaths\)/);
assert.match(context, /MAX_AUTO_TOTAL_CHARS/, "Automatic reads are bounded");
assert.match(context, /Never say you cannot access or read the repository/, "The assistant must not claim it cannot read a connected repository");
assert.doesNotMatch(context, /ask them to name the exact file path/, "The assistant must not push the user to name files for general questions");
assert.match(context, /fetchedFilePaths = usableFiles\.map/, "Automatically read files are counted as verified reads");
assert.match(native, /isRepositoryQuestion\(latest\)/, "Repository questions (including Sinhala) reach the repository tools");
assert.match(native, /\[\\u0D80-\\u0DFF\]\/\.test\(value\) && isRepositoryQuestion\(value\)/);

console.log("GitHub repository context checks passed: question detection, automatic file reads, large repositories, and honest connection status.");
