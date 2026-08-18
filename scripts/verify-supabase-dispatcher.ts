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
import { deriveSupabaseReadIntent } from "../lib/supabaseReadIntent";

const projectId = "abcdefghijklmnopqrst";

assert.deepEqual(
  deriveSupabaseReadIntent("Show my connected Supabase projects", "", null),
  { tool: "list_projects" },
  "project discovery must use the verified tool path without a selected project",
);
assert.deepEqual(
  deriveSupabaseReadIntent("Please show the columns in the conversations table", "", projectId),
  { tool: "describe_table", projectId, table: "conversations" },
  "a selected table schema read must enter the verified describe_table tool path",
);
assert.equal(
  deriveSupabaseReadIntent("Delete the conversations table from Supabase", "", projectId),
  undefined,
  "a mutation must not enter the automatic read dispatcher or create a false read card",
);

const validRequest = `I will inspect the connected project.

<supabase-tool>{"action":"list_tables","project_id":"${projectId}"}</supabase-tool>`;
const validIntent = parseSupabaseReadToolIntents(validRequest);
assert.equal(validIntent.length, 1, "a verified list_tables tool request should parse");
assert.deepEqual(validIntent[0], { tool: "list_tables", projectId });
assert.equal(stripSupabaseReadToolBlocks(validRequest), "I will inspect the connected project.");

const projectList = parseSupabaseReadToolIntents(`<supabase-tool>{"action":"list_projects"}</supabase-tool>`);
assert.deepEqual(projectList, [{ tool: "list_projects" }], "a project-list tag should enter the verified dispatcher");

const safeRows = parseSupabaseReadToolIntents(`<supabase-tool>{"action":"read_rows","project_id":"${projectId}","table":"profiles","columns":["id","display_name","email; DROP TABLE users"],"limit":999}</supabase-tool>`);
assert.equal(safeRows.length, 1, "a bounded safe row-read tool request should parse");
assert.deepEqual(safeRows[0], {
  tool: "read_rows",
  projectId,
  table: "profiles",
  columns: ["id", "display_name"],
  limit: 25,
});

const rejectedWrite = parseSupabaseReadToolIntents(`<supabase-tool>{"action":"delete","project_id":"${projectId}","table":"profiles"}</supabase-tool>`);
assert.equal(rejectedWrite.length, 0, "write tools must not enter the automatic read dispatcher");

const rejectedPlaceholder = parseSupabaseReadToolIntents(`<supabase-tool>{"action":"list_tables","project_id":"unknown"}</supabase-tool>`);
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

const projectsCard = createSupabaseReadBlock({
  state: "success",
  kind: "projects",
  title: "Verified Supabase projects",
  message: "2 connected project(s) returned.",
  projects: [
    { id: projectId, name: "Nexo", region: "ap-southeast-1" },
    { id: "zyxwvutsrqponmlkjihg", name: "Sandbox", region: null },
  ],
});
assert.deepEqual(parseSupabaseReadBlocks(projectsCard)[0]?.projects?.map((project) => project.name), ["Nexo", "Sandbox"], "verified project data must survive the live-card transport");

const errorCard = createSupabaseReadBlock({
  state: "error",
  kind: "schema",
  projectId,
  title: "Could not reach Supabase",
  message: "No data is being claimed.",
});
assert.equal(parseSupabaseReadBlocks(errorCard)[0]?.state, "error", "a truthful error state should remain distinct from a success card");

console.log("Supabase dispatcher local checks passed: 11 assertions groups.");
