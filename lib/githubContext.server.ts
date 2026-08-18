// NEXO AI — GitHub context helper
// CRITICAL: server-only. This reads the user's GitHub connection (access token +
// selected repo) from Supabase and optionally pulls file contents from the
// GitHub API, so that this context can be injected into the chat model's
// system prompt. Never import this into a "use client" file.

import { createClient } from "@supabase/supabase-js";
import { resolveGitHubCredential } from "@/lib/githubApp.server";

const GITHUB_API = "https://api.github.com";
const MAX_FILE_BYTES = 40_000; // guard against dumping huge files into the prompt
const MAX_FILES_PER_REQUEST = 4;

interface GithubConnection {
  access_token: string | null;
  installation_id: string | number | null;
  selected_repo: string | null;
  github_username: string | null;
}

interface RepoTreeEntry {
  path: string;
  type: "blob" | "tree";
}

export interface GithubContextResult {
  connected: boolean;
  repoFullName: string | null;
  contextBlock: string; // ready to append to the system prompt, empty if nothing to add
  /** Paths whose current content was actually fetched for this chat turn. */
  fetchedFilePaths: string[];
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getConnection(userId: string): Promise<GithubConnection | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("github_connections")
    .select("access_token, installation_id, selected_repo, github_username")
    .eq("user_id", userId)
    .maybeSingle();

  return data ?? null;
}

// Pulls the repo's default branch tree (paths only, not content) so the model
// knows what files exist without us shipping every file's contents up front.
async function fetchRepoTree(
  repoFullName: string,
  accessToken: string
): Promise<RepoTreeEntry[]> {
  try {
    const repoRes = await fetch(`${GITHUB_API}/repos/${repoFullName}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!repoRes.ok) return [];
    const repoJson = await repoRes.json();
    const defaultBranch = repoJson.default_branch ?? "main";

    const treeRes = await fetch(
      `${GITHUB_API}/repos/${repoFullName}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!treeRes.ok) return [];
    const treeJson = await treeRes.json();
    if (!Array.isArray(treeJson.tree)) return [];

    return treeJson.tree
      .filter((entry: any) => entry.type === "blob")
      .map((entry: any) => ({ path: entry.path, type: "blob" as const }));
  } catch (err) {
    console.error("[github-context] Failed to fetch repo tree:", err);
    return [];
  }
}

// Fetches raw file content for a specific path in the repo, base64-decoded.
async function fetchFileContent(
  repoFullName: string,
  filePath: string,
  accessToken: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${repoFullName}/contents/${filePath}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.content || json.encoding !== "base64") return null;

    const decoded = Buffer.from(json.content, "base64").toString("utf-8");
    if (decoded.length > MAX_FILE_BYTES) {
      return `${decoded.slice(0, MAX_FILE_BYTES)}\n\n... [file truncated, ${decoded.length} bytes total]`;
    }
    return decoded;
  } catch (err) {
    console.error(`[github-context] Failed to fetch file ${filePath}:`, err);
    return null;
  }
}

// Very simple heuristic to spot file paths the user is asking about in their
// message, e.g. "explain lib/urlReader.server.ts" or "fix the route.ts in api/chat".
// This is intentionally conservative: exact-match against the tree paths only,
// so it never guesses a path that doesn't actually exist in the repo.
function extractReferencedPaths(userText: string, treePaths: string[]): string[] {
  const found: string[] = [];
  for (const path of treePaths) {
    const fileName = path.split("/").pop();
    if (!fileName) continue;
    // A bare, very common file name (route.ts, page.tsx, index.ts...) exists in
    // many folders, so matching on it alone pulls in the wrong file. Those only
    // count when the user typed enough of the path to disambiguate.
    const isAmbiguous = treePaths.filter((p) => p.endsWith(`/${fileName}`) || p === fileName).length > 1;
    const matches = userText.includes(path) || (!isAmbiguous && userText.includes(fileName));
    if (matches) {
      found.push(path);
      if (found.length >= MAX_FILES_PER_REQUEST) break;
    }
  }
  return found;
}

// Main entry point used by chat/route.ts. Given the userId and the latest
// user message, returns a ready-to-inject system prompt block describing the
// active repo, its file structure, and the content of any files the user
// appears to be referencing directly.
export async function buildGithubContext(
  userId: string | undefined,
  latestUserMessage: string
): Promise<GithubContextResult> {
  if (!userId) {
    return { connected: false, repoFullName: null, contextBlock: "", fetchedFilePaths: [] };
  }

  const connection = await getConnection(userId);
  if (!connection || !connection.selected_repo) {
    return { connected: !!connection, repoFullName: null, contextBlock: "", fetchedFilePaths: [] };
  }

  const repoFullName = connection.selected_repo;
  let accessToken: string;
  try {
    accessToken = (await resolveGitHubCredential(connection, "read")).token;
  } catch {
    return {
      connected: true,
      repoFullName,
      contextBlock: `\n\nThe user has repository "${repoFullName}" selected as active, but its saved secret could not be used. Ask the user to reconnect GitHub in Integrations.`,
      fetchedFilePaths: [],
    };
  }

  const tree = await fetchRepoTree(repoFullName, accessToken);
  if (tree.length === 0) {
    // Repo is selected but we couldn't read it (bad token, repo deleted, etc.)
    // Tell the model plainly rather than pretending nothing is connected.
    return {
      connected: true,
      repoFullName,
      contextBlock: `\n\nThe user has repository "${repoFullName}" selected as active, but it could not be read right now (permissions or connectivity issue). Let the user know you couldn't access repo contents this turn, rather than assuming or inventing file contents.`,
      fetchedFilePaths: [],
    };
  }

  const treePaths = tree.map((entry) => entry.path);
  const referencedPaths = extractReferencedPaths(latestUserMessage, treePaths);

  let fileContentsBlock = "";
  let fetchedFilePaths: string[] = [];
  if (referencedPaths.length > 0) {
    const fetchedFiles = await Promise.all(
      referencedPaths.map(async (path) => ({
        path,
        content: await fetchFileContent(repoFullName, path, accessToken),
      }))
    );
    const usableFiles = fetchedFiles.filter((f) => f.content !== null);
    if (usableFiles.length > 0) {
      fetchedFilePaths = usableFiles.map((file) => file.path);
      fileContentsBlock = usableFiles
        .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
        .join("\n\n");
    }
  }

  const treeSummary =
    treePaths.length > 100
      ? `${treePaths.slice(0, 100).join("\n")}\n... [${treePaths.length - 100} more files not shown]`
      : treePaths.join("\n");

  const contextBlock = `

===== ACTIVE GITHUB REPOSITORY =====
The user's active repository is: ${repoFullName}
Below is the current file structure of this repository (paths only). Use this as ground truth for what files exist — never invent file names or paths that are not listed here.

${treeSummary}
===== END REPOSITORY STRUCTURE =====${
    fileContentsBlock
      ? `\n\n===== FETCHED FILE CONTENTS =====\nThe user's message appears to reference the following file(s). Their current real content is provided below — use it as ground truth when discussing, explaining, or proposing changes to these files.\n\n${fileContentsBlock}\n===== END FETCHED FILE CONTENTS =====`
      : `\n\nNo specific file was fetched for this message. If the user asks about a particular file's contents and you need to see it, ask them to name the exact file path, or tell them you'll need it referenced by name so it can be fetched.`
  }`;

  return { connected: true, repoFullName, contextBlock, fetchedFilePaths };
}
