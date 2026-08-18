import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptGithubToken } from "@/lib/githubToken.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface CommitFile {
  filePath: string;
  content: string;
  type: "editing" | "creating" | "deleting";
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

async function ghFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) {
  const res = await fetch(url, init);
  const body = await res.text().catch(() => "");
  return { status: res.status, body: body ? body : "" };
}

// POST /api/github/commit — apply approved file changes to the user's
// selected repo via the GitHub Git Data API (atomic multi-file commit).
// Supports two modes: "direct" (commit to main) and "pr" (create branch + PR).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid commit request" }), { status: 400 });
  }
  const {
    userId,
    files,
    commitMessage,
    mode = "direct",
    branchName,
  } = body as {
    userId: string;
    files: CommitFile[];
    commitMessage: string;
    mode?: "direct" | "pr";
    branchName?: string;
  };

  if (!userId || !files || files.length === 0) {
    return new Response(JSON.stringify({ error: "Missing userId or files" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const supabase = getSupabaseAdmin();
  const { data: connection } = await supabase
    .from("github_connections")
    .select("access_token, selected_repo")
    .eq("user_id", verified.user.id)
    .maybeSingle();

  if (!connection || !connection.selected_repo) {
    return new Response(
      JSON.stringify({ error: "No GitHub repo selected. Choose one in Settings first." }),
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = decryptGithubToken(connection.access_token);
  } catch {
    return new Response(
      JSON.stringify({ error: "Saved GitHub secret could not be used. Reconnect GitHub in Integrations." }),
      { status: 400 }
    );
  }
  const repo = connection.selected_repo; // "owner/repo"
  const [owner, repoName] = repo.split("/");
  const api = (path: string) => `https://api.github.com/repos/${owner}/${repoName}/${path}`;

  const results: { filePath: string; success: boolean; error?: string }[] = [];

  // ─── STEP 1: Get the base commit (SHA + tree SHA) from main branch ───
  let baseCommitSha: string;
  let baseTreeSha: string;

  const branchRes = await ghFetch(api("branches/main"), {
    method: "GET",
    headers: ghHeaders(token),
  });

  if (branchRes.status !== 200) {
    return new Response(
      JSON.stringify({
        error: `Failed to fetch main branch: ${branchRes.body.slice(0, 200)}`,
      }),
      { status: 400 }
    );
  }

  const branchData = JSON.parse(branchRes.body);
  baseCommitSha = branchData.commit.sha;
  baseTreeSha = branchData.commit.commit.tree.sha;

  // ─── STEP 2: Get base tree (recursive) to check existing files ───
  const treeRes = await ghFetch(api(`git/trees/${baseTreeSha}?recursive=1`), {
    method: "GET",
    headers: ghHeaders(token),
  });

  if (treeRes.status !== 200) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch base tree: ${treeRes.body.slice(0, 200)}` }),
      { status: 400 }
    );
  }

  const baseTree = JSON.parse(treeRes.body);
  const baseTreeEntries: Record<string, string> = {};
  for (const entry of baseTree.tree) {
    if (entry.type === "blob") {
      baseTreeEntries[entry.path] = entry.sha;
    }
  }

  // ─── STEP 3: Validate diffs & build file operations ───
  const treeChanges: {
    path: string;
    mode: "100644" | "100755";
    type: "blob";
    content?: string;
    sha?: string;
  }[] = [];

  // For "editing" files, we need to fetch current content and apply diff
  // For validation, we check that the file exists before editing/deleting
  for (const file of files) {
    if (file.type === "editing" || file.type === "deleting") {
      // Verify file exists in repo
      if (!(file.filePath in baseTreeEntries)) {
        results.push({
          filePath: file.filePath,
          success: false,
          error: `File does not exist in the repository (stale diff): ${file.filePath}`,
        });
        continue;
      }
    }

    if (file.type === "creating") {
      // Verify file doesn't already exist (to avoid overwriting)
      if (file.filePath in baseTreeEntries) {
        results.push({
          filePath: file.filePath,
          success: false,
          error: `File already exists in the repository: ${file.filePath}`,
        });
        continue;
      }
    }
  }

  // If any validation failed, abort the entire commit
  if (results.some((r) => !r.success)) {
    return new Response(JSON.stringify({ success: false, results }), { status: 400 });
  }

  // ─── STEP 4: Create blobs for new/modified files ───
  const createdBlobs: Record<string, string> = {}; // filePath → blob SHA

  for (const file of files) {
    if (file.type === "deleting") {
      // Deleted files are omitted from the new tree (Git handles this)
      continue;
    }

    // Create blob
    const blobRes = await ghFetch(api("git/blobs"), {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        content: file.content,
        encoding: "utf-8",
      }),
    });

    if (blobRes.status !== 201) {
      results.push({
        filePath: file.filePath,
        success: false,
        error: `Failed to create blob for ${file.filePath}: ${blobRes.body.slice(0, 200)}`,
      });
      continue;
    }

    const blobData = JSON.parse(blobRes.body);
    createdBlobs[file.filePath] = blobData.sha;
    results.push({ filePath: file.filePath, success: true });
  }

  // Check if all blobs were created successfully
  if (results.some((r) => !r.success)) {
    return new Response(JSON.stringify({ success: false, results }), { status: 400 });
  }

  // ─── STEP 5: Build new tree ───
  // Start with all base entries, remove deleted files, add new/modified blobs
  const newTreeEntries: { path: string; mode: string; type: string; sha: string }[] = [];

  // Copy base entries (excluding deleted files)
  const deletedPaths = new Set(files.filter((f) => f.type === "deleting").map((f) => f.filePath));
  for (const [path, sha] of Object.entries(baseTreeEntries)) {
    if (!deletedPaths.has(path)) {
      newTreeEntries.push({ path, mode: "100644", type: "blob", sha });
    }
  }

  // Add new/modified blobs
  for (const [path, blobSha] of Object.entries(createdBlobs)) {
    newTreeEntries.push({ path, mode: "100644", type: "blob", sha: blobSha });
  }

  const newTreeRes = await ghFetch(api("git/trees"), {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: newTreeEntries,
    }),
  });

  if (newTreeRes.status !== 201) {
    return new Response(
      JSON.stringify({ error: `Failed to create tree: ${newTreeRes.body.slice(0, 200)}` }),
      { status: 400 }
    );
  }

  const newTree = JSON.parse(newTreeRes.body);
  const newTreeSha = newTree.sha;

  // ─── STEP 6: Create commit ───
  const commitMsg = commitMessage || `feat: multi-file update via NEXO Craft V3 (${files.length} files)`;

  let targetBranch = "main";
  let targetBranchSha = baseCommitSha;

  if (mode === "pr" && branchName) {
    // Create new branch from main
    const createRefRes = await ghFetch(api("git/refs"), {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseCommitSha,
      }),
    });

    if (createRefRes.status !== 201) {
      return new Response(
        JSON.stringify({
          error: `Failed to create branch: ${createRefRes.body.slice(0, 200)}`,
        }),
        { status: 400 }
      );
    }

    targetBranch = branchName;
    // Don't update targetBranchSha yet — we'll update the ref after commit
  }

  const newCommitRes = await ghFetch(api("git/commits"), {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      message: commitMsg,
      tree: newTreeSha,
      parents: mode === "pr" ? [baseCommitSha] : [baseCommitSha],
    }),
  });

  if (newCommitRes.status !== 201) {
    return new Response(
      JSON.stringify({ error: `Failed to create commit: ${newCommitRes.body.slice(0, 200)}` }),
      { status: 400 }
    );
  }

  const newCommit = JSON.parse(newCommitRes.body);
  const newCommitSha = newCommit.sha;

  // ─── STEP 7: Update branch ref ───
  const updateRefRes = await ghFetch(api(`git/refs/heads/${targetBranch}`), {
    method: "PATCH",
    headers: ghHeaders(token),
    body: JSON.stringify({
      sha: newCommitSha,
      force: false,
    }),
  });

  if (updateRefRes.status !== 200) {
    return new Response(
      JSON.stringify({
        error: `Failed to update branch ${targetBranch}: ${updateRefRes.body.slice(0, 200)}`,
      }),
      { status: 400 }
    );
  }

  // ─── STEP 8: If PR mode, create Pull Request ───
  let prUrl: string | null = null;
  let prHtmlUrl: string | null = null;

  if (mode === "pr" && branchName) {
    const prRes = await ghFetch(api("pulls"), {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        title: commitMsg,
        head: branchName,
        base: "main",
        body: `This PR was created by NEXO AI (Craft V3) with the following changes:\n\n${files
          .map((f) => `- **${f.type}**: \`${f.filePath}\``)
          .join("\n")}\n\nPlease review before merging.`,
      }),
    });

    if (prRes.status === 201) {
      const prData = JSON.parse(prRes.body);
      prUrl = prData.url;
      prHtmlUrl = prData.html_url;
    }
    // If PR creation fails, we still return the commit — PR can be created manually
  }

  const commitHtmlUrl = `https://github.com/${owner}/${repoName}/commit/${newCommitSha}`;
  const compareUrl = `https://github.com/${owner}/${repoName}/compare/${baseCommitSha}...${newCommitSha}`;

  return new Response(
    JSON.stringify({
      success: true,
      results,
      commitSha: newCommitSha,
      commitUrl: commitHtmlUrl,
      compareUrl,
      branch: targetBranch,
      prUrl,
      prHtmlUrl,
      mode,
    }),
    { status: 200 }
  );
}
