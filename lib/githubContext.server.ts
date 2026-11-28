// KYVORIX AI — GitHub context helper
// CRITICAL: server-only. This reads the user's GitHub connection (access token +
// selected repo) from Supabase and optionally pulls file contents from the
// GitHub API, so that this context can be injected into the chat model's
// system prompt. Never import this into a "use client" file.

import { createClient } from "@supabase/supabase-js";
import { resolveGithubConnectionCredential } from "@/lib/githubApp.server";
import {
  MAX_AUTO_FILE_CHARS,
  MAX_AUTO_TOTAL_CHARS,
  chooseAutoFiles,
  isRepositoryQuestion,
  summarizeTree,
} from "@/lib/githubRepoHeuristics";

const GITHUB_API = "https://api.github.com";
// A normal application page can exceed 40KB. Preserve a substantially larger
// verified source window so the model can inspect the complete file in the
// common case instead of analysing a misleading prefix.
const MAX_FILE_BYTES = 200_000;
const MAX_FILES_PER_REQUEST = 4;

const GITHUB_READ_MAX_ATTEMPTS = 4;
const GITHUB_READ_TIMEOUT_MS = 180_000;
const GITHUB_RETRY_DELAYS_MS = [1_500, 4_000, 9_000] as const;

interface GithubConnection {
  access_token: string;
  selected_repo: string | null;
  github_username: string | null;
  installation_id: string | null;
}

interface RepoTreeEntry {
  path: string;
  type: "blob" | "tree";
}

function shouldRetryGithubRead(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function githubHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
  };
}

async function fetchGithubRead(url: string, accessToken: string): Promise<Response | null> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < GITHUB_READ_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: githubHeaders(accessToken),
        cache: "no-store",
        signal: AbortSignal.timeout(GITHUB_READ_TIMEOUT_MS),
      });
      lastResponse = response;
      if (response.ok || !shouldRetryGithubRead(response.status) || attempt === GITHUB_READ_MAX_ATTEMPTS - 1) {
        return response;
      }
    } catch (error) {
      console.warn(`[github-context] Read attempt ${attempt + 1}/${GITHUB_READ_MAX_ATTEMPTS} failed:`, error);
      if (attempt === GITHUB_READ_MAX_ATTEMPTS - 1) return null;
    }

    const delay = GITHUB_RETRY_DELAYS_MS[attempt] ?? GITHUB_RETRY_DELAYS_MS.at(-1)!;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return lastResponse;
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
    .select("access_token, selected_repo, github_username, installation_id")
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
    const repoRes = await fetchGithubRead(`${GITHUB_API}/repos/${repoFullName}`, accessToken);
    if (!repoRes?.ok) return [];
    const repoJson = await repoRes.json();
    const defaultBranch = repoJson.default_branch ?? "main";

    const treeRes = await fetchGithubRead(
      `${GITHUB_API}/repos/${repoFullName}/git/trees/${defaultBranch}?recursive=1`,
      accessToken,
    );
    if (!treeRes?.ok) return [];
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
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const res = await fetchGithubRead(`${GITHUB_API}/repos/${repoFullName}/contents/${encodedPath}`, accessToken);
    if (!res?.ok) return null;
    const json = await res.json();
    if (!json.content || json.encoding !== "base64") return null;

    const decoded = Buffer.from(json.content, "base64").toString("utf-8");
    if (decoded.length > MAX_FILE_BYTES) {
      return `${decoded.slice(0, MAX_FILE_BYTES)}\n\n... [verified source exceeds the safe single-read window: ${decoded.length} bytes total]`;
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
  if (!connection) {
    const contextBlock = isRepositoryQuestion(latestUserMessage)
      ? "\n\nGITHUB IS NOT CONNECTED for this user. If they ask about their repository or code, tell them plainly to open Integrations → GitHub and connect it (then choose a repository). Do not invent repository contents."
      : "";
    return { connected: false, repoFullName: null, contextBlock, fetchedFilePaths: [] };
  }
  if (!connection.selected_repo) {
    const contextBlock = isRepositoryQuestion(latestUserMessage)
      ? `\n\nGITHUB IS CONNECTED${connection.github_username ? ` (account: ${connection.github_username})` : ""} but NO REPOSITORY IS SELECTED. If the user asks about their repository or code, tell them to open Integrations → GitHub and pick the repository they want you to work on. Do not say GitHub is not connected, and do not invent repository contents.`
      : "";
    return { connected: true, repoFullName: null, contextBlock, fetchedFilePaths: [] };
  }

  const repoFullName = connection.selected_repo;
  let credential = await resolveGithubConnectionCredential({
    installationId: connection.installation_id,
    encryptedOAuthToken: connection.access_token,
  });
  if (!credential) {
    return {
      connected: true,
      repoFullName,
      contextBlock: `\n\nThe user has repository "${repoFullName}" selected as active, but its saved secret could not be used. Ask the user to reconnect GitHub in Integrations.`,
      fetchedFilePaths: [],
    };
  }

  let tree = await fetchRepoTree(repoFullName, credential.token);
  // An App installation may be valid but not include the selected repository.
  // Retry with the existing encrypted OAuth connection without exposing either
  // credential to the client or the model.
  if (tree.length === 0 && credential.source === "github-app") {
    const oauthCredential = await resolveGithubConnectionCredential({
      encryptedOAuthToken: connection.access_token,
    });
    if (oauthCredential) {
      credential = oauthCredential;
      tree = await fetchRepoTree(repoFullName, credential.token);
    }
  }
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
  const namedPaths = extractReferencedPaths(latestUserMessage, treePaths);
  // Nothing named? For a question about the repository, read the key files
  // ourselves instead of leaving the assistant blind.
  const autoSelected = namedPaths.length === 0 && isRepositoryQuestion(latestUserMessage);
  const referencedPaths = autoSelected ? chooseAutoFiles(latestUserMessage, treePaths) : namedPaths;

  let fileContentsBlock = "";
  let fetchedFilePaths: string[] = [];
  let unreadableFilePaths: string[] = [];
  if (referencedPaths.length > 0) {
    const fetchedFiles = await Promise.all(
      referencedPaths.map(async (path) => ({
        path,
        content: await fetchFileContent(repoFullName, path, credential.token),
      }))
    );
    let usableFiles = fetchedFiles.filter((f) => f.content !== null);
    unreadableFilePaths = fetchedFiles.filter((f) => f.content === null).map((file) => file.path);
    if (autoSelected) {
      // Keep automatic reads small enough for the prompt, and never report an
      // automatic read failure as if the user had asked for that file.
      unreadableFilePaths = [];
      let budget = MAX_AUTO_TOTAL_CHARS;
      usableFiles = usableFiles.flatMap((file) => {
        if (budget <= 0) return [];
        const content = (file.content as string).slice(0, Math.min(MAX_AUTO_FILE_CHARS, budget));
        budget -= content.length;
        const cut = (file.content as string).length > content.length;
        return [{ path: file.path, content: cut ? `${content}\n\n... [truncated for this summary read]` : content }];
      });
    }
    if (usableFiles.length > 0) {
      fetchedFilePaths = usableFiles.map((file) => file.path);
      fileContentsBlock = usableFiles
        .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
        .join("\n\n");
    }
  }

  const treeSummary = summarizeTree(treePaths);

  const contextBlock = `

===== ACTIVE GITHUB REPOSITORY =====
The user's active repository is: ${repoFullName}
Below is the current file structure of this repository (paths only). Use this as ground truth for what files exist — never invent file names or paths that are not listed here.

${treeSummary}
===== END REPOSITORY STRUCTURE =====${
    fileContentsBlock
      ? `\n\n===== FETCHED FILE CONTENTS =====\n${autoSelected ? "The repository's key files were read automatically for this question" : "The user's message appears to reference the following file(s)"}. Their current real content is provided below — use it as ground truth when discussing, explaining, or proposing changes to these files. ${autoSelected ? "Other files exist (see the structure above) and can be read on request." : ""}\n\n${fileContentsBlock}\n===== END FETCHED FILE CONTENTS =====`
      : unreadableFilePaths.length > 0
        ? `\n\n===== VERIFIED REPOSITORY READ FAILURE =====\nThe requested file read did not complete after ${GITHUB_READ_MAX_ATTEMPTS} server-side attempts: ${unreadableFilePaths.join(", ")}. Do not infer, summarize, explain, or propose unrelated work from this unread file. State only that KYVORIX could not complete the verified read and offer to retry the same path.\n===== END REPOSITORY READ FAILURE =====`
        : `\n\nThe repository IS connected and its structure is listed above. No file contents are attached to this message. Never say you cannot access or read the repository. Answer from the structure, use any tool results you were given, and if you need a particular file's contents, name the path you would read and ask the user to confirm it (or to mention it) so it can be fetched.`
  }`;

  return { connected: true, repoFullName, contextBlock, fetchedFilePaths };
}
