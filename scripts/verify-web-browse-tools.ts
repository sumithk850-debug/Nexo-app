import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  decodeGithubFile,
  githubPublicRepo,
  githubSearchRepositories,
  normalizeRepoPath,
  parsePublicRepoReference,
  type FetchLike,
} from "../lib/githubPublic.server";
import { shouldUseWebBrowseIntent } from "../lib/webBrowseIntent";
import { KNOWN_TOOL_NAMES, stripRawToolCallText } from "../lib/toolTextGuard";

const read = (path: string) => readFileSync(path, "utf8");
const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function main() {
  // -------------------------------------------------------------------------
  // 1. Repository references: accept real GitHub references, reject everything else.
  // -------------------------------------------------------------------------
  assert.deepEqual(parsePublicRepoReference("octocat/Hello-World"), { owner: "octocat", repo: "Hello-World", path: "" });
  assert.deepEqual(parsePublicRepoReference("https://github.com/octocat/Hello-World"), { owner: "octocat", repo: "Hello-World", path: "" });
  assert.deepEqual(parsePublicRepoReference("https://www.github.com/octocat/Hello-World.git"), { owner: "octocat", repo: "Hello-World", path: "" });
  assert.deepEqual(parsePublicRepoReference("github.com/octocat/Hello-World"), { owner: "octocat", repo: "Hello-World", path: "" });
  assert.deepEqual(parsePublicRepoReference("https://github.com/octocat/Hello-World/tree/dev/src/lib"), { owner: "octocat", repo: "Hello-World", path: "src/lib", ref: "dev" });
  assert.deepEqual(parsePublicRepoReference("https://github.com/octocat/Hello-World/blob/main/README.md?plain=1#L3"), { owner: "octocat", repo: "Hello-World", path: "README.md", ref: "main" });
  assert.deepEqual(parsePublicRepoReference("octocat/Hello-World", "/docs/guide.md/", "v1.2.0"), { owner: "octocat", repo: "Hello-World", path: "docs/guide.md", ref: "v1.2.0" });
  assert.deepEqual(parsePublicRepoReference("https://github.com/octocat/Hello-World/tree/main/src", "other"), { owner: "octocat", repo: "Hello-World", path: "other", ref: "main" }, "An explicit path wins over the link");
  for (const bad of [
    "https://evil.example/octocat/Hello-World",
    "http://github.com.evil.example/octocat/Hello-World",
    "https://user:pass@github.com/octocat/Hello-World",
    "ftp://github.com/octocat/Hello-World",
    "javascript://github.com/octocat/Hello-World",
    "octocat",
    "",
    "-bad/Hello-World",
    "octo cat/Hello-World",
    "octocat/..",
    "octocat/Hello World",
    42,
    null,
  ]) {
    assert.equal(parsePublicRepoReference(bad as unknown), null, `Must reject ${String(bad)}`);
  }
  assert.equal(parsePublicRepoReference("octocat/Hello-World", "../secret"), null, "Path traversal is rejected");
  assert.equal(parsePublicRepoReference("octocat/Hello-World", "a//b"), null);
  assert.equal(parsePublicRepoReference("octocat/Hello-World", "a\\b"), null);
  assert.equal(parsePublicRepoReference("octocat/Hello-World", "x".repeat(401)), null);
  assert.equal(parsePublicRepoReference("octocat/Hello-World", "", "../main"), null, "A branch cannot traverse");
  assert.equal(parsePublicRepoReference("octocat/Hello-World", "", "feature.lock"), null);
  assert.equal(normalizeRepoPath("/a/b/"), "a/b");
  assert.equal(normalizeRepoPath(""), "");
  assert.equal(normalizeRepoPath("a/./b"), null);

  // -------------------------------------------------------------------------
  // 2. File decoding.
  // -------------------------------------------------------------------------
  assert.deepEqual(decodeGithubFile({ content: b64("hello සිංහල"), encoding: "base64", size: 14 }), { text: "hello සිංහල" });
  assert.equal(decodeGithubFile({ content: b64("x".repeat(9000)), encoding: "base64", size: 9000 }).truncated, true);
  assert.ok(decodeGithubFile({ content: b64("ab\u0000cd"), encoding: "base64", size: 5 }).reason?.includes("binary"));
  assert.ok(decodeGithubFile({ content: b64("x"), encoding: "base64", size: 999_999 }).reason?.includes("larger"));
  assert.ok(decodeGithubFile({ content: "plain", encoding: "none", size: 5 }).reason);

  // -------------------------------------------------------------------------
  // 3. Going inside a public repository (GitHub API mocked, real production code).
  // -------------------------------------------------------------------------
  const requested: Array<{ url: string; headers: Record<string, string> }> = [];
  const meta = { full_name: "octocat/Hello-World", description: "My first repository", language: "Python", stargazers_count: 42, forks_count: 7, default_branch: "main", pushed_at: "2026-01-01T00:00:00Z", topics: ["demo"], html_url: "https://github.com/octocat/Hello-World", private: false };
  const mockGithub: FetchLike = async (url, init) => {
    requested.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "api.github.com", "Only the GitHub API host may be called");
    const path = decodeURIComponent(parsed.pathname);
    if (path === "/repos/octocat/Hello-World") return jsonResponse(meta);
    if (path === "/repos/octocat/Hello-World/readme") return new Response("# Hello World\nThis is the README.", { status: 200 });
    if (path === "/repos/octocat/Hello-World/contents") return jsonResponse([{ name: "src", path: "src", type: "dir" }, { name: "README.md", path: "README.md", type: "file", size: 34 }, { name: "x", path: "x" }, null]);
    if (path === "/repos/octocat/Hello-World/contents/src") return jsonResponse([{ name: "app.py", path: "src/app.py", type: "file", size: 20 }]);
    if (path === "/repos/octocat/Hello-World/contents/src/app.py") return jsonResponse({ type: "file", size: 20, encoding: "base64", content: b64("print('hi')\n") });
    if (path === "/repos/octocat/Hello-World/contents/logo.png") return jsonResponse({ type: "file", size: 5, encoding: "base64", content: b64("PNG\u0000\u0001") });
    if (path === "/repos/octocat/Hello-World/contents/my folder/ファイル.md") return jsonResponse({ type: "file", size: 3, encoding: "base64", content: b64("ok!") });
    if (path === "/repos/octocat/Private-One") return jsonResponse({ ...meta, full_name: "octocat/Private-One", private: true });
    if (path === "/repos/octocat/Limited") return new Response("rate", { status: 403 });
    if (path === "/repos/octocat/Broken") return new Response("boom", { status: 500 });
    return new Response("nope", { status: 404 });
  };

  const overview = await githubPublicRepo({ repo: "https://github.com/octocat/Hello-World" }, mockGithub);
  assert.equal(overview.ok, true);
  assert.equal(overview.kind, "overview");
  assert.equal(overview.repository, "octocat/Hello-World");
  assert.match(String(overview.readme), /Hello World/);
  assert.deepEqual((overview.entries as Array<{ name: string }>).map((entry) => entry.name), ["src", "README.md", "x"], "Malformed entries are skipped");
  assert.equal(((overview.details as Record<string, unknown>).stars), 42);

  const folder = await githubPublicRepo({ repo: "octocat/Hello-World", path: "src" }, mockGithub);
  assert.equal(folder.kind, "directory");
  assert.equal((folder.entries as Array<{ path: string }>)[0].path, "src/app.py");

  const file = await githubPublicRepo({ repo: "octocat/Hello-World", path: "src/app.py" }, mockGithub);
  assert.equal(file.kind, "file");
  assert.equal(file.content, "print('hi')\n");
  assert.equal(file.truncated, false);

  const viaLink = await githubPublicRepo({ repo: "https://github.com/octocat/Hello-World/blob/main/src/app.py" }, mockGithub);
  assert.equal(viaLink.path, "src/app.py");
  assert.ok(requested.some((call) => call.url.includes("/contents/src/app.py?ref=main")), "A branch from the link is sent as ref");

  const unicode = await githubPublicRepo({ repo: "octocat/Hello-World", path: "my folder/ファイル.md" }, mockGithub);
  assert.equal(unicode.content, "ok!");
  assert.ok(requested.some((call) => call.url.includes("my%20folder/%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB.md")), "Path segments are URL-encoded");

  const binary = await githubPublicRepo({ repo: "octocat/Hello-World", path: "logo.png" }, mockGithub);
  assert.equal(binary.content, "");
  assert.match(String(binary.unreadable), /binary/);

  await assert.rejects(() => githubPublicRepo({ repo: "octocat/Private-One" }, mockGithub), /not found, or it is not public/);
  await assert.rejects(() => githubPublicRepo({ repo: "octocat/Missing" }, mockGithub), /not found/);
  await assert.rejects(() => githubPublicRepo({ repo: "octocat/Hello-World", path: "nope/none" }, mockGithub), /not found/);
  await assert.rejects(() => githubPublicRepo({ repo: "octocat/Limited" }, mockGithub), /rate limit.*not accessible/);
  await assert.rejects(() => githubPublicRepo({ repo: "octocat/Broken" }, mockGithub), /not available/);
  await assert.rejects(() => githubPublicRepo({ repo: "https://evil.example/a/b" }, mockGithub), /valid public GitHub repository/);
  await assert.rejects(() => githubPublicRepo({ repo: "octocat/Hello-World", path: "../etc" }, mockGithub), /valid public GitHub repository/);
  await assert.rejects(() => githubPublicRepo({ repo: "octocat/Hello-World" }, async () => { throw new Error("network down"); }), /not available right now/);

  // Requests are plain GETs with an identifying User-Agent, and never carry credentials by default.
  assert.ok(requested.every((call) => call.headers["User-Agent"] && !call.headers.Authorization));
  process.env.GITHUB_PUBLIC_API_TOKEN = "test-token-123";
  requested.length = 0;
  await githubPublicRepo({ repo: "octocat/Hello-World", path: "src" }, mockGithub);
  assert.ok(requested.every((call) => call.headers.Authorization === "Bearer test-token-123"), "An optional server token raises the rate limit");
  delete process.env.GITHUB_PUBLIC_API_TOKEN;

  // -------------------------------------------------------------------------
  // 4. Finding someone's repository.
  // -------------------------------------------------------------------------
  const searchCalls: string[] = [];
  const mockSearch: FetchLike = async (url) => {
    searchCalls.push(url);
    return jsonResponse({
      total_count: 3,
      items: [
        { full_name: "sumithk850-debug/nexo-app", description: "AI workspace", language: "TypeScript", stargazers_count: 3, pushed_at: "2026-11-01T00:00:00Z", html_url: "https://github.com/sumithk850-debug/nexo-app", private: false },
        { full_name: "secret/hidden", private: true },
        { nope: true },
      ],
    });
  };
  const found = await githubSearchRepositories({ query: "nexo user:sumithk850-debug", limit: 99 }, mockSearch);
  assert.equal(found.ok, true);
  assert.equal((found.repositories as unknown[]).length, 1, "Private and malformed results are dropped");
  assert.ok(searchCalls[0].startsWith("https://api.github.com/search/repositories?q=nexo%20user%3Asumithk850-debug&per_page=8"), "The query is encoded and the limit is capped");
  await assert.rejects(() => githubSearchRepositories({ query: "a" }, mockSearch), /at least two characters/);
  await assert.rejects(() => githubSearchRepositories({}, mockSearch), /at least two characters/);

  // -------------------------------------------------------------------------
  // 5. When does a message ask to look something up on the web and go inside it?
  // -------------------------------------------------------------------------
  for (const yes of [
    "Search the web for the repository of sumithk850-debug and go inside it",
    "Find sumithk850-debug's nexo-app repo on GitHub and read the README",
    "look up torvalds' repositories online",
    "open github.com/vercel/next.js and tell me what's inside",
    "Can you browse the web and open that website's pricing page?",
    "find octocat/Hello-World repository on github and show me the files",
    "sumith ගේ repo එක වෙබ් එකෙන් හොයලා ඇතුලට පිවිසිලා බලන්න",
    "ඔබට ගිතුබ් එකේ රෙපෝ එකක් සොයලා ඇතුලට ගිහින් බලන්න පුළුවන්ද",
    "වෙබ් එකේ ඒ වෙබ්සයිට් එකේ ලින්ක් එක විවෘත කරලා කියවන්න",
  ]) {
    assert.equal(shouldUseWebBrowseIntent(yes), true, `Should browse: ${yes}`);
  }
  for (const no of [
    "hello",
    "What is a repository?",
    "Write a python function that sorts a list",
    "Explain how recursion works",
    "ඔබට කොහොමද?",
    "",
    "x".repeat(5000),
  ]) {
    assert.equal(shouldUseWebBrowseIntent(no), false, `Should not browse: ${no.slice(0, 40)}`);
  }

  // -------------------------------------------------------------------------
  // 6. Raw tool-call text never reaches the reply.
  // -------------------------------------------------------------------------
  const clean = (text: string, streaming = false) => stripRawToolCallText(text, { streaming });
  assert.equal(clean("Plain answer with no tools."), "Plain answer with no tools.");
  assert.equal(clean("<tool_call>{\"name\":\"github_read_file\",\"arguments\":{\"path\":\"a.ts\"}}</tool_call>\nHere is the answer."), "Here is the answer.");
  assert.equal(clean("Let me check.\n<function_calls>\n<invoke name=\"web_fetch_url\"><parameter name=\"url\">https://x.com</parameter></invoke>\n</function_calls>\nDone."), "Let me check.\n\nDone.");
  assert.equal(clean("<|tool_calls_section_begin|><|tool_call_begin|>functions.github_read_file:0<|tool_call_end|><|tool_calls_section_end|>Result:"), "Result:");
  assert.equal(clean("<function=web_fetch_url>{\"url\":\"https://x.com\"}</function>Answer"), "Answer");
  assert.equal(clean("[TOOL_CALLS] [{\"name\":\"vercel_list_projects\",\"arguments\":{}}]\nThe projects are:"), "The projects are:");
  assert.equal(clean("functions.github_list_files({\"path_prefix\":\"app\"})\nFiles listed below."), "Files listed below.");
  assert.equal(clean("Calling tool: github_read_file {\"path\":\"README.md\"}\nIt says hello."), "It says hello.");
  assert.equal(clean("call-tool (GitHub read file)\nThe file says hi."), "The file says hi.");
  assert.equal(clean("Tool call · GitHub read file\nThe file says hi."), "The file says hi.");
  assert.equal(clean("Before {\"name\": \"supabase_read_rows\", \"arguments\": {\"table\": \"a{b}\", \"note\": \"}\"}} after"), "Before  after", "Braces inside JSON strings are handled");
  assert.equal(clean("{\"tool\":\"tavily_web_research\",\"arguments\":{\"query\":\"x\"}}\nAnswer"), "Answer");
  // Ordinary JSON, prose and code that merely resemble tool syntax are preserved.
  assert.equal(clean("Use {\"name\":\"Alice\",\"age\":3} as the payload."), "Use {\"name\":\"Alice\",\"age\":3} as the payload.");
  assert.equal(clean("The word call-tool appears in this sentence about tools."), "The word call-tool appears in this sentence about tools.");
  assert.equal(clean("Compare a < b and c > d, then use <div> tags."), "Compare a < b and c > d, then use <div> tags.");
  const fenced = "Example:\n```xml\n<tool_call>{\"name\":\"github_read_file\"}</tool_call>\n```\nThat is what the format looks like.";
  assert.equal(clean(fenced), fenced, "Fenced code blocks are never modified");
  assert.equal(clean("~~~\nfunctions.github_list_files({})\n~~~\nok"), "~~~\nfunctions.github_list_files({})\n~~~\nok");
  assert.equal(clean("<tool_call>x</tool_call>A\n```js\n<tool_call>keep</tool_call>\n```\n<tool_call>y</tool_call>B"), "A\n```js\n<tool_call>keep</tool_call>\n```\nB");
  assert.equal(clean(clean("<tool_call>x</tool_call>Hi")), "Hi", "Cleaning twice changes nothing more");

  // Streaming: a half-written call is hidden at every possible prefix, never flashed.
  const streamSample = "I will look into it.\n<tool_call>{\"name\":\"github_read_file\",\"arguments\":{\"path\":\"src/app.ts\"}}</tool_call>\nThe file defines the app. Use {\"x\":1} here and a<b.";
  const expectedFinal = clean(streamSample);
  assert.equal(expectedFinal, "I will look into it.\n\nThe file defines the app. Use {\"x\":1} here and a<b.");
  for (let length = 0; length <= streamSample.length; length++) {
    const shown = clean(streamSample.slice(0, length), true);
    assert.ok(!/<tool_call|functions\.|"name"\s*:\s*"github_read_file|<tool_c|<tool/.test(shown), `Raw call text leaked at prefix ${length}: ${JSON.stringify(shown)}`);
  }
  assert.equal(clean(streamSample, true), expectedFinal, "The complete streamed text matches the final text");
  assert.equal(clean("Answer so far {\"name\":\"github_read_file\",\"argum", true), "Answer so far ", "A half-written JSON call is hidden");
  assert.equal(clean("Text <tool_c", true), "Text ", "A fragment that may become a call is held back");
  assert.equal(clean("Text <b", true), "Text <b", "An ordinary tag fragment is not hidden");
  assert.equal(clean("```\n<tool_call>still in code", true), "```\n<tool_call>still in code", "An unfinished code fence is code");

  // -------------------------------------------------------------------------
  // 7. Wiring: the tools exist, are documented, verified and shown as cards.
  // -------------------------------------------------------------------------
  const native = read("lib/nativeTools.server.ts");
  const guard = read("lib/toolCallGuard.ts");
  const docs = read("lib/toolDocumentation.ts");
  const display = read("lib/toolCallDisplay.ts");
  const page = read("app/page.tsx");
  const route = read("app/api/chat/route.ts");
  const reader = read("lib/urlReader.server.ts");

  const definedTools = [...native.matchAll(/name: "([a-z_]+)"/g)].map((match) => match[1]).filter((name) => /^(web_|tavily_|wikipedia_|github_|supabase_|vercel_)/.test(name));
  assert.ok(definedTools.length >= 13, "All tool definitions were found");
  for (const name of new Set(definedTools)) {
    assert.ok((KNOWN_TOOL_NAMES as readonly string[]).includes(name), `${name} must be known to the raw tool text guard`);
    assert.ok(docs.includes(`${name}: {`), `${name} must have tool documentation (undocumented tools are unavailable)`);
    assert.ok(display.includes(`${name}:`), `${name} must have a readable card label`);
  }
  assert.match(native, /name === "github_public_repo"\) return await githubPublicRepo\(args\)/);
  assert.match(native, /name === "github_search_repositories"\) return await githubSearchRepositories\(args\)/);
  assert.match(native, /readPublicPage\(url\)/, "Web fetch uses the SSRF-protected page reader");
  assert.match(native, /links,\n\s*};/, "Web fetch returns the page links so the model can go deeper");
  assert.match(native, /shouldUseWebBrowseIntent\(value\)/, "Web browsing requests trigger the tool loop");
  assert.match(native, /WEB BROWSING GUIDE/);
  assert.match(guard, /github_public_repo: \(\) =>/);
  assert.match(guard, /github_search_repositories: \(\) =>/);
  assert.match(reader, /export async function readPublicPage/);
  assert.match(reader, /if \(!\(await isSafeUrl\(url\)\)\)/, "The page reader still blocks private addresses");
  assert.match(reader, /redirect: "manual"/, "Redirects are still validated one by one");

  assert.equal((page.match(/stripRawToolCallText\(/g) ?? []).length >= 3, true, "Streaming, flush and final text must all be cleaned");
  assert.match(page, /stripRawToolCallText\(normalizeRepositoryReadClaims\(accumulated, verifiedReadPaths\)\)/, "The saved reply is cleaned");
  assert.match(route, /TOOL ACTIVITY DISPLAY RULE/);
  assert.match(route, /systemPrompt \+= NO_RAW_TOOL_SYNTAX_RULE;/, "Every model is told not to write tool syntax");

  // The public GitHub tools never touch credentials or the user's connected repository.
  const publicModule = read("lib/githubPublic.server.ts");
  assert.doesNotMatch(publicModule, /access_token|installation_id|github_connections|supabaseAdmin/, "Public browsing must not use connected-account credentials");
  assert.doesNotMatch(publicModule, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/i, "Public browsing is read-only");

  console.log("Web browse tool checks passed: public GitHub navigation, web fetch links, intent detection, raw tool-call text removal, and wiring.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
