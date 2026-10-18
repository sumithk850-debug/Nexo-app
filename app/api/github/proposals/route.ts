import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { githubApiHeaders, resolveGithubConnectionCredential } from "@/lib/githubApp.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
type ChangeKind = "editing" | "creating" | "deleting";
type ProposalFile = { filePath: string; content: string; type: ChangeKind };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function safePath(path: string) {
  return Boolean(path) && !path.startsWith("/") && !path.includes("\\") &&
    path.split("/").every((part) => Boolean(part) && part !== "." && part !== "..");
}
function repoParts(value: string) {
  const parts = value.split("/");
  return parts.length === 2 && parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))
    ? { owner: parts[0], repo: parts[1] } : null;
}
async function gh(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { ...githubApiHeaders(token, Boolean(init.body)), ...(init.headers ?? {}) }, cache: "no-store" });
  const text = await response.text();
  return { response, text };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { userId?: string; files?: ProposalFile[]; commitMessage?: string; mode?: "direct" | "pr"; branchName?: string } | null;
  if (!body || !body.userId || !Array.isArray(body.files) || body.files.length === 0 || body.files.length > MAX_FILES) {
    return json({ error: `Provide between 1 and ${MAX_FILES} proposed files.` }, 400);
  }
  const verified = await requireVerifiedUser(req, body.userId);
  if (verified.response) return verified.response;
  const mode = body.mode ?? "direct";
  if (mode !== "direct" && mode !== "pr") return json({ error: "Unsupported commit mode." }, 400);
  if (mode === "pr" && (!body.branchName || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,98}$/.test(body.branchName))) return json({ error: "Provide a valid pull request branch." }, 400);

  const files: ProposalFile[] = [];
  const seen = new Set<string>();
  for (const raw of body.files) {
    const filePath = typeof raw?.filePath === "string" ? raw.filePath.trim() : "";
    const content = typeof raw?.content === "string" ? raw.content : "";
    if (!safePath(filePath) || seen.has(filePath)) return json({ error: "Each proposed file path must be safe and unique." }, 400);
    if (!["editing", "creating", "deleting"].includes(raw?.type)) return json({ error: "Unsupported file change type." }, 400);
    if (raw.type !== "deleting" && Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) return json({ error: "A proposed file is too large." }, 400);
    seen.add(filePath);
    files.push({ filePath, content, type: raw.type });
  }

  const supabase = db();
  const { data: connection } = await supabase.from("github_connections")
    .select("selected_repo, installation_id, access_token")
    .eq("user_id", verified.user.id).maybeSingle();
  if (!connection?.selected_repo) return json({ error: "No GitHub repository is selected." }, 400);
  const parts = repoParts(connection.selected_repo);
  if (!parts) return json({ error: "The selected GitHub repository is invalid." }, 400);
  const credential = await resolveGithubConnectionCredential({ installationId: connection.installation_id, encryptedOAuthToken: connection.access_token });
  if (!credential) return json({ error: "GitHub needs to be reconnected before proposing changes." }, 409);

  const api = `https://api.github.com/repos/${parts.owner}/${parts.repo}`;
  const repo = await gh(api, credential.token);
  if (!repo.response.ok) return json({ error: "The selected repository could not be verified." }, 409);
  const repoData = JSON.parse(repo.text) as { default_branch?: string; permissions?: { push?: boolean } };
  if (!repoData.default_branch || repoData.permissions?.push !== true) return json({ error: "The connected GitHub integration does not have verified write access." }, 403);

  const branch = encodeURIComponent(repoData.default_branch);
  const ref = await gh(`${api}/git/ref/heads/${branch}`, credential.token);
  if (!ref.response.ok) return json({ error: "The repository branch could not be read." }, 409);
  const refData = JSON.parse(ref.text) as { object?: { sha?: string } };
  const baseCommitSha = refData.object?.sha;
  if (!baseCommitSha) return json({ error: "GitHub did not return the current branch commit." }, 409);
  const commit = await gh(`${api}/git/commits/${baseCommitSha}`, credential.token);
  if (!commit.response.ok) return json({ error: "The repository base commit could not be read." }, 409);
  const baseTreeSha = (JSON.parse(commit.text) as { tree?: { sha?: string } }).tree?.sha;
  if (!baseTreeSha) return json({ error: "GitHub did not return the current repository tree." }, 409);

  const tree = await gh(`${api}/git/trees/${baseTreeSha}?recursive=1`, credential.token);
  if (!tree.response.ok) return json({ error: "The repository tree could not be verified." }, 409);
  const treeData = JSON.parse(tree.text) as { truncated?: boolean; tree?: Array<{ path: string; type: string }> };
  if (treeData.truncated || !Array.isArray(treeData.tree)) return json({ error: "The repository is too large to verify safely." }, 409);
  const existing = new Set(treeData.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path));
  for (const file of files) {
    if ((file.type === "editing" || file.type === "deleting") && !existing.has(file.filePath)) return json({ error: `File no longer exists: ${file.filePath}` }, 409);
    if (file.type === "creating" && existing.has(file.filePath)) return json({ error: `File already exists: ${file.filePath}` }, 409);
  }

  const { data, error } = await supabase.from("github_write_proposals").insert({
    user_id: verified.user.id,
    repo_full_name: connection.selected_repo,
    base_commit_sha: baseCommitSha,
    base_tree_sha: baseTreeSha,
    default_branch: repoData.default_branch,
    commit_message: (typeof body.commitMessage === "string" && body.commitMessage.trim() ? body.commitMessage.trim() : "Approved repository update").slice(0, 500),
    files,
    target_mode: mode,
    target_branch: mode === "pr" ? body.branchName : null,
  }).select("id, expires_at").single();
  if (error || !data) return json({ error: "The approved proposal could not be saved." }, 500);
  return json({ proposalId: data.id, expiresAt: data.expires_at }, 201);
}
