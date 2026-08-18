import assert from "node:assert/strict";
import {
  parseSupabaseReadToolIntents,
  stripSupabaseReadToolBlocks,
} from "../lib/supabaseToolParser";
import {
  createSupabaseReadBlock,
  parseSupabaseReadBlocks,
  stripSupabaseReadBlocks,
} from "../lib/supabaseReadParser";

const projectId = "abcdefghijklmnopqrst";

const validRequest = `I will inspect the connected project.

\`\`\`supabase-tool
tool: list_tables
project_id: ${projectId}
\`\`\``;
const validIntent = parseSupabaseReadToolIntents(validRequest);
assert.equal(validIntent.length, 1, "a verified list_tables tool request should parse");
assert.deepEqual(validIntent[0], { tool: "list_tables", projectId });
assert.equal(stripSupabaseReadToolBlocks(validRequest), "I will inspect the connected project.");

const safeRows = parseSupabaseReadToolIntents(`\`\`\`supabase-tool
tool: read_rows
project_id: ${projectId}
table: profiles
columns: ["id", "display_name", "email; DROP TABLE users"]
limit: 999
\`\`\``);
assert.equal(safeRows.length, 1, "a bounded safe row-read tool request should parse");
assert.deepEqual(safeRows[0], {
  tool: "read_rows",
  projectId,
  table: "profiles",
  columns: ["id", "display_name"],
  limit: 25,
});

const rejectedWrite = parseSupabaseReadToolIntents(`\`\`\`supabase-tool
tool: delete
project_id: ${projectId}
table: profiles
\`\`\``);
assert.equal(rejectedWrite.length, 0, "write tools must not enter the automatic read dispatcher");

const rejectedPlaceholder = parseSupabaseReadToolIntents(`\`\`\`supabase-tool
tool: list_tables
project_id: unknown
\`\`\``);
assert.equal(rejectedPlaceholder.length, 0, "placeholder project IDs must be rejected before a network call");

const liveCard = createSupabaseReadBlock({
  state: "success",
  kind: "schema",
  projectId,
  title: "Verified Supabase table result",
  message: "2 public tables returned.",
  tableNames: ["profiles", "messages"],
});
const parsedCards = parseSupabaseReadBlocks(liveCard);
assert.equal(parsedCards.length, 1, "a server-produced live card should parse");
assert.equal(parsedCards[0]?.state, "success");
assert.deepEqual(parsedCards[0]?.tableNames, ["profiles", "messages"]);
assert.equal(stripSupabaseReadBlocks(liveCard), "", "transport blocks must not leak into normal assistant prose");

const errorCard = createSupabaseReadBlock({
  state: "error",
  kind: "schema",
  projectId,
  title: "Could not reach Supabase",
  message: "No data is being claimed.",
});
assert.equal(parseSupabaseReadBlocks(errorCard)[0]?.state, "error", "a truthful error state should remain distinct from a success card");

console.log("Supabase dispatcher local checks passed: 6 assertions groups.");
