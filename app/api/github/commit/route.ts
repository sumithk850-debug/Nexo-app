import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createInstallationAccessToken,
  githubApiHeaders,
  isGitHubAppConfigured,
} from "@/lib/githubApp.server";
import {
  checkGithubOAuthRepositoryWrite,
  resolveGithubOAuthToken,
} from "@/lib/githubOAuth.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

const MAX_FILES_PER_COMMIT = 50;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type ChangeKind = "editing" | "creating" | "deleting";

interface CommitFile {
  filePath: string;
  content: string;
  type: ChangeKind;
}

interface GitTreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function safeGitHubMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed.message === "string") return parsed.message.slice(0, 240);
  } catch {
    // Use the generic message below when the provider response is not JSON.
  }
  return "GitHub rejected this request.";
}

async function githubRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text().catch(() => "");
  return { response, text };
}

function normalizeRepo(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1] || /\s/.test(fullName)) return null;
  return { owner: parts[0], repo: parts[1] };
}

function isSafePath(path: string): boolean {
  return (
    Boolean(path) &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    path.split("/").every((part) => Boolean(part) && part !== "." && part !== "..")
  );
}

function isSafeBranchName(branchName: string): boolean {
  return (
    Boolean(branchName) &&
    branchName.length <= 240 &&
    !branchName.startsWith("/") &&
    !branchName.endsWith("/") &&
    !branchName.includes("..") &&
    !branchName.includes("//") &&
    !/[~^:?*\\[\s]/.test(branchName) &&
    !branchName.endsWith(".lock")
  );
}

/**
 * POST /api/github/commit
 *
 * This endpoint is reachable only after the user approves the repository change
 * proposal in the client. It uses a verified server-held per-user credential
 * (an installed GitHub App when available, otherwise the user's OAuth token),
 * never a browser-supplied token, and makes one atomic multi-file commit using
 * GitHub's Git Data API.
 */
export async function POST(req: NextRequest) {
  const requestBody = await req.json().catch(() => null);
  if (!requestBody || typeof requestBody !== "object") {
    return json({ error: "Invalid commit request." }, 400);
  }

  const { userId, files, commitMessage, mode = "direct", branchName, approvalGranted } = requestBody as {
    userId?: string;
    files?: CommitFile[];
    commitMessage?: string;
    mode?: "direct" | "pr";
    branchName?: string;
    approvalGranted?: boolean;
  };

  if (approvalGranted !== true) {
    return json({ error: "Repository changes require an explicit approval before they can be committed." }, 403);
  }
  if (!userId || !Array.isArray(files) || files.length === 0 || files.length > MAX_FILES_PER_COMMIT) {
    return json({ error: `Provide between 1 and ${MAX_FILES_PER_COMMIT} files to commit.` }, 400);
  }
  if (mode !== "direct" && mode !== "pr") {
    return json({ error: "Unsupported commit mode." }, 400);
  }
  if (mode === "pr" && (!branchName || !isSafeBranchName(branchName))) {
    return json({ error: "Provide a valid branch name for a pull request." }, 400);
  }

  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const validationResults: Array<{ filePath: string; success: boolean; error?: string }> = [];
  const uniquePaths = new Set<string>();
  for (const file of files) {
    const filePath = typeof file?.filePath === "string" ? file.filePath.trim() : "";
    const content = typeof file?.content === "string" ? file.content : "";
    if (!isSafePath(filePath)) {
      validationResults.push({ filePath, success: false, error: "The file path is not allowed." });
    } else if (uniquePaths.has(filePath)) {
      validationResults.push({ filePath, success: false, error: "The same file was proposed more than once." });
    } else if (file.type !== "editing" && file.type !== "creating" && file.type !== "deleting") {
      validationResults.push({ filePath, success: false, error: "The file change type is not supported." });
    } else if (file.type !== "deleting" && Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      validationResults.push({ filePath, success: false, error: "The proposed file is too large to commit safely." });
    }
    uniquePaths.add(filePath);
  }
  if (validationResults.length > 0) return json({ success: false, results: validationResults }, 400);

  const supabase = getSupabaseAdmin();
  const { data: connection, error: connectionError } = await supabase
    .from("github_connections")
    .select("selected_repo, installation_id, access_token")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (connectionError || !connection?.selected_repo) {
    return json({ error: "No GitHub repository is selected. Choose one in Settings before approving changes." }, 400);
  }
  const repository = normalizeRepo(connection.selected_repo);
  if (!repository) {
    return json({ error: "The selected GitHub repository is invalid. Select it again in Settings." }, 400);
  }

  // Prefer the narrower GitHub App installation token when this optional
  // upgrade exists. Every connected user can still write through their own
  // OAuth connection, provided GitHub confirms push access to the selected repo.
  let serverToken: string | null = null;
  if (connection.installation_id && isGitHubAppConfigured()) {
    try {
      serverToken = (await createInstallationAccessToken(connection.installation_id)).token;
    } catch {
      // Fall through to the user's encrypted OAuth connection below.
    }
  }

  if (!serverToken) {
    const oauthToken = resolveGithubOAuthToken(connection.access_token);
    if (!oauthToken) {
      return json(
        {
          error: "GitHub needs to be reconnected before repository changes can be approved.",
          needsWriteAccess: true,
        },
        409
      );
    }

    const oauthWriteCheck = await checkGithubOAuthRepositoryWrite(oauthToken, connection.selected_repo);
    if (!oauthWriteCheck.canWrite) {
      return json(
        {
          error: "Your connected GitHub account cannot push to the selected repository. Reconnect GitHub and grant repository access, or select a repository where you have write permission.",
          needsWriteAccess: true,
        },
        403
      );
    }
    serverToken = oauthToken;
  }

  const api = (path: string) => `https://api.github.com/repos/${repository.owner}/${repository.repo}/${path}`;
  const headers = githubApiHeaders(serverToken, true);

  // Resolve the repository's configured default branch. Never assume "main".
  const repositoryResponse = await githubRequest(api(""), { headers });
  if (!repositoryResponse.response.ok) {
    return json({ error: `Could not read the selected repository: ${safeGitHubMessage(repositoryResponse.text)}` }, 400);
  }
  const repositoryData = JSON.parse(repositoryResponse.text) as { default_branch?: string; permissions?: { push?: boolean } };
  const defaultBranch = repositoryData.default_branch;
  if (!defaultBranch) return json({ error: "GitHub did not provide a default branch for this repository." }, 400);
  if (mode === "pr" && branchName === defaultBranch) {
    return json({ error: "A pull request branch must be different from the repository default branch." }, 400);
  }
  if (repositoryData.permissions?.push === false) {
    return json({ error: "The connected GitHub account does not have write access to the selected repository.", needsWriteAccess: true }, 403);
  }

  const encodedDefaultBranch = encodeURIComponent(defaultBranch);
  const refResponse = await githubRequest(api(`git/ref/heads/${encodedDefaultBranch}`), { headers });
  if (!refResponse.response.ok) {
    return json({ error: `Could not read the default branch: ${safeGitHubMessage(refResponse.text)}` }, 400);
  }
  const refData = JSON.parse(refResponse.text) as { object?: { sha?: string } };
  const baseCommitSha = refData.object?.sha;
  if (!baseCommitSha) return json({ error: "GitHub did not provide the default branch commit." }, 400);

  const baseCommitResponse = await githubRequest(api(`git/commits/${baseCommitSha}`), { headers });
  if (!baseCommitResponse.response.ok) {
    return json({ error: `Could not read the base commit: ${safeGitHubMessage(baseCommitResponse.text)}` }, 400);
  }
  const baseCommitData = JSON.parse(baseCommitResponse.text) as { tree?: { sha?: string } };
  const baseTreeSha = baseCommitData.tree?.sha;
  if (!baseTreeSha) return json({ error: "GitHub did not provide the base repository tree." }, 400);

  // A recursive tree lets Nexo verify the approved diff against the current
  // repository state and preserve the original executable mode when editing.
  const treeResponse = await githubRequest(api(`git/trees/${baseTreeSha}?recursive=1`), { headers });
  if (!treeResponse.response.ok) {
    return json({ error: `Could not read the repository tree: ${safeGitHubMessage(treeResponse.text)}` }, 400);
  }
  const treeData = JSON.parse(treeResponse.text) as { truncated?: boolean; tree?: GitTreeEntry[] };
  if (treeData.truncated || !Array.isArray(treeData.tree)) {
    return json({ error: "The repository tree is too large to verify safely. Narrow the approved change set and try again." }, 409);
  }
  const existingEntries = new Map(treeData.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry]));

  for (const file of files) {
    const existing = existingEntries.get(file.filePath);
    if ((file.type === "editing" || file.type === "deleting") && !existing) {
      validationResults.push({ filePath: file.filePath, success: false, error: "The file no longer exists in the selected repository." });
    }
    if (file.type === "creating" && existing) {
      validationResults.push({ filePath: file.filePath, success: false, error: "The file already exists in the selected repository." });
    }
  }
  if (validationResults.length > 0) return json({ success: false, results: validationResults }, 409);

  const blobs = new Map<string, string>();
  for (const file of files) {
    if (file.type === "deleting") continue;
    const blobResponse = await githubRequest(api("git/blobs"), {
      method: "POST",
      headers,
      body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
    });
    if (!blobResponse.response.ok) {
      return json(
        {
          success: false,
          results: [{ filePath: file.filePath, success: false, error: `GitHub could not prepare this file: ${safeGitHubMessage(blobResponse.text)}` }],
        },
        400
      );
    }
    const blobData = JSON.parse(blobResponse.text) as { sha?: string };
    if (!blobData.sha) return json({ error: `GitHub did not return a file reference for ${file.filePath}.` }, 400);
    blobs.set(file.filePath, blobData.sha);
  }

  const changes = files.map((file) => {
    const existing = existingEntries.get(file.filePath);
    if (file.type === "deleting") {
      return { path: file.filePath, mode: existing?.mode ?? "100644", type: "blob", sha: null };
    }
    return {
      path: file.filePath,
      mode: existing?.mode ?? "100644",
      type: "blob",
      sha: blobs.get(file.filePath),
    };
  });

  const newTreeResponse = await githubRequest(api("git/trees"), {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: changes }),
  });
  if (!newTreeResponse.response.ok) {
    return json({ error: `GitHub could not build the approved file tree: ${safeGitHubMessage(newTreeResponse.text)}` }, 400);
  }
  const newTree = JSON.parse(newTreeResponse.text) as { sha?: string };
  if (!newTree.sha) return json({ error: "GitHub did not return the approved file tree." }, 400);

  const message = typeof commitMessage === "string" && commitMessage.trim()
    ? commitMessage.trim().slice(0, 500)
    : `chore: approved Nexo repository update (${files.length} files)`;
  const newCommitResponse = await githubRequest(api("git/commits"), {
    method: "POST",
    headers,
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
  });
  if (!newCommitResponse.response.ok) {
    return json({ error: `GitHub could not create the approved commit: ${safeGitHubMessage(newCommitResponse.text)}` }, 400);
  }
  const newCommit = JSON.parse(newCommitResponse.text) as { sha?: string };
  if (!newCommit.sha) return json({ error: "GitHub did not return the approved commit." }, 400);

  let targetBranch = defaultBranch;
  let prHtmlUrl: string | null = null;
  let prWarning: string | null = null;

  if (mode === "pr") {
    targetBranch = branchName!;
    const newRefResponse = await githubRequest(api("git/refs"), {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${targetBranch}`, sha: newCommit.sha }),
    });
    if (!newRefResponse.response.ok) {
      return json({ error: `The approved commit was created, but GitHub could not create the pull-request branch: ${safeGitHubMessage(newRefResponse.text)}` }, 409);
    }

    const pullRequestResponse = await githubRequest(api("pulls"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: message,
        head: targetBranch,
        base: defaultBranch,
        body: "This pull request was created from an approved Nexo repository change. Please review before merging.",
      }),
    });
    if (pullRequestResponse.response.ok) {
      const pullRequest = JSON.parse(pullRequestResponse.text) as { html_url?: string };
      prHtmlUrl = pullRequest.html_url ?? null;
    } else {
      prWarning = `The branch was created, but GitHub could not open the pull request: ${safeGitHubMessage(pullRequestResponse.text)}`;
    }
  } else {
    const updateRefResponse = await githubRequest(api(`git/refs/heads/${encodedDefaultBranch}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    if (!updateRefResponse.response.ok) {
      return json({ error: `The approved commit was created, but GitHub could not update ${defaultBranch}: ${safeGitHubMessage(updateRefResponse.text)}` }, 409);
    }
  }

  const commitUrl = `https://github.com/${repository.owner}/${repository.repo}/commit/${newCommit.sha}`;
  return json({
    success: true,
    results: files.map((file) => ({ filePath: file.filePath, success: true })),
    commitSha: newCommit.sha,
    commitUrl,
    compareUrl: `https://github.com/${repository.owner}/${repository.repo}/compare/${baseCommitSha}...${newCommit.sha}`,
    branch: targetBranch,
    prHtmlUrl,
    prWarning,
    mode,
  });
}
