// KYVORIX AI — keeps raw tool-call syntax out of the visible reply.
//
// While a tool runs, the chat shows a card. Models sometimes also write the
// call itself as text (XML-style wrappers, special tokens, JSON arguments,
// "functions.name(...)"). That text is noise and must never appear in the
// reply. This guard removes it from streamed and final text, leaves fenced code
// blocks untouched, and hides a half-written call until it is complete.
//
// Pure and dependency-free so it can be verified directly.

/** Tool names the assistant can call. Kept in sync with lib/nativeTools.server.ts by a verification script. */
export const KNOWN_TOOL_NAMES = [
  "web_fetch_url",
  "tavily_web_research",
  "wikipedia_search",
  "github_list_files",
  "github_read_file",
  "github_public_repo",
  "github_search_repositories",
  "supabase_list_projects",
  "supabase_list_tables",
  "supabase_describe_table",
  "supabase_read_rows",
  "vercel_list_projects",
  "vercel_list_deployments",
] as const;

const TOOL_NAME_ALTERNATION = KNOWN_TOOL_NAMES.join("|");

// Paired wrappers that surround a whole call.
const WRAPPER_TAGS = [
  "tool_call",
  "tool_calls",
  "tool_use",
  "tool_code",
  "tool_request",
  "tool_response",
  "function_call",
  "function_calls",
  "function_results",
  "antml:function_calls",
  "invoke",
];

const SPECIAL_TOKEN_BLOCKS: Array<[string, string]> = [
  ["<|tool_calls_section_begin|>", "<|tool_calls_section_end|>"],
  ["<|tool_call_begin|>", "<|tool_call_end|>"],
  ["<｜tool▁calls▁begin｜>", "<｜tool▁calls▁end｜>"],
  ["<｜tool▁call▁begin｜>", "<｜tool▁call▁end｜>"],
];

const OPENERS: string[] = [
  ...WRAPPER_TAGS.map((tag) => `<${tag}`),
  ...SPECIAL_TOKEN_BLOCKS.map(([open]) => open),
  "<function=",
  "<|python_tag|>",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Index of the "}" that closes the "{" at `start`, or -1 when the object is not complete yet. */
function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function stripSegment(segment: string, streaming: boolean): string {
  let text = segment;

  // 1. Paired wrappers: <tool_call>...</tool_call>, <invoke ...>...</invoke>, special tokens.
  for (const tag of WRAPPER_TAGS) {
    const name = escapeRegExp(tag);
    text = text.replace(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, "gi"), "");
  }
  for (const [open, close] of SPECIAL_TOKEN_BLOCKS) {
    text = text.replace(new RegExp(`${escapeRegExp(open)}[\\s\\S]*?${escapeRegExp(close)}`, "g"), "");
  }
  text = text.replace(/<function=[A-Za-z0-9_.-]+>[\s\S]*?<\/function>/gi, "");
  text = text.replace(/<\|python_tag\|>[^\n]*/g, "");

  // 2. Whole-line call syntax.
  text = text.replace(/^[ \t]*\[TOOL_CALLS\][^\n]*\n?/gim, "");
  text = text.replace(/^[ \t]*(?:call-tool|tool[ _-]?call)\s*[:(·][^\n]*\n?/gim, "");
  text = text.replace(new RegExp(`^[ \\t]*(?:calling\\s+(?:the\\s+)?tool\\s*:?\\s*)?(?:functions\\.)?(?:${TOOL_NAME_ALTERNATION})\\s*\\([^\\n]*\\)[ \\t]*\\n?`, "gim"), "");
  text = text.replace(new RegExp(`^[ \\t]*(?:calling\\s+(?:the\\s+)?tool|using\\s+(?:the\\s+)?tool)\\s*:?\\s*\`?(?:${TOOL_NAME_ALTERNATION})\`?[^\\n]*\\n?`, "gim"), "");

  // 3. JSON call objects that name a known tool, e.g. {"name":"github_read_file","arguments":{...}}.
  const jsonStart = new RegExp(`\\{\\s*"(?:name|tool|tool_name|function|recipient_name)"\\s*:\\s*"(?:functions\\.)?(?:${TOOL_NAME_ALTERNATION})"`, "g");
  for (let guard = 0; guard < 50; guard++) {
    jsonStart.lastIndex = 0;
    const match = jsonStart.exec(text);
    if (!match) break;
    const end = matchingBrace(text, match.index);
    if (end < 0) {
      if (streaming) {
        // Still being written: hide it until it is complete.
        text = text.slice(0, match.index);
        break;
      }
      text = text.slice(0, match.index) + text.slice(match.index + match[0].length);
      continue;
    }
    // Also drop an enclosing array bracket / trailing comma left behind.
    text = text.slice(0, match.index) + text.slice(end + 1);
  }

  // 4. A call that is still being written (opening marker without its end) is hidden while streaming.
  if (streaming) {
    let cut = -1;
    for (const opener of OPENERS) {
      const index = text.toLowerCase().lastIndexOf(opener.toLowerCase());
      if (index >= 0 && (cut < 0 || index < cut)) cut = index;
    }
    if (cut >= 0) text = text.slice(0, cut);
    // A trailing fragment that might become an opener ("<tool_c") is held back too.
    const tail = text.slice(Math.max(0, text.length - 24));
    const lower = tail.toLowerCase();
    for (let length = Math.min(lower.length, 23); length > 0; length--) {
      const fragment = lower.slice(lower.length - length);
      if (fragment.startsWith("<") && OPENERS.some((opener) => opener.toLowerCase().startsWith(fragment) && fragment.length < opener.length)) {
        text = text.slice(0, text.length - length);
        break;
      }
    }
  }
  return text;
}

/**
 * Removes raw tool-call text from assistant output. Fenced code blocks are
 * never modified (so a reply that legitimately shows such syntax in a code block
 * is preserved). Pass `streaming: true` while the reply is still arriving.
 */
export function stripRawToolCallText(input: string, options: { streaming?: boolean } = {}): string {
  const streaming = options.streaming === true;
  if (!input) return input;
  // Cheap early exit for the overwhelming majority of text, which has nothing to remove.
  const mayContainToolSyntax = /<(?:tool|function|invoke|antml|\|)|<｜|<\|python_tag|\[TOOL_CALLS\]|call-tool|tool[ _-]?call|calling\s+(?:the\s+)?tool|using\s+(?:the\s+)?tool|functions\.|"(?:name|tool|tool_name|function|recipient_name)"\s*:/i;
  const endsWithPossibleOpener = streaming && /<[A-Za-z_|｜=▁]{0,24}$/.test(input);
  if (!mayContainToolSyntax.test(input) && !endsWithPossibleOpener) return input;

  // Split into prose and fenced code; only prose is cleaned.
  const pieces = input.split(/(^|\n)((?:```|~~~)[^\n]*\n[\s\S]*?(?:\n(?:```|~~~)[ \t]*(?=\n|$)|$))/g);
  // Re-assemble: split with two capture groups yields [prose, nl, fence, prose, nl, fence, ...].
  let output = "";
  for (let index = 0; index < pieces.length; index += 3) {
    const prose = pieces[index] ?? "";
    const newline = pieces[index + 1] ?? "";
    const fence = pieces[index + 2] ?? "";
    output += stripSegment(prose, streaming) + newline + fence;
  }
  if (output === input) return input;
  // Tidy the gaps left behind without touching the rest of the text.
  return output.replace(/\n{3,}/g, "\n\n").replace(/^\s*\n/, "");
}
