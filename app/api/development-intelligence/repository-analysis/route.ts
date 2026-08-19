import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { getDevelopmentIntelligenceAdmin } from "@/lib/developmentIntelligence.server";
import { resolveGithubOAuthToken } from "@/lib/githubOAuth.server";
import { githubApiHeaders } from "@/lib/githubApp.server";

export const runtime = "nodejs";

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
};

type GitHubRepository = {
  full_name: string;
  default_branch: string;
  private: boolean;
  permissions?: { push?: boolean; admin?: boolean };
  language?: string | null;
  updated_at?: string;
};

type GitHubWorkflowRun = {
  id: number;
  name?: string;
  display_title?: string;
  status?: string;
  conclusion?: string | null;
  updated_at?: string;
  head_branch?: string;
  event?: string;
};

type WorkflowHealth = {
  availability: "available" | "unavailable";
  total: number;
  successful: number;
  failed: number;
  inProgress: number;
  latest: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    updatedAt: string | null;
    branch: string | null;
    event: string | null;
  }>;
};

function summarizeWorkflowHealth(runs: GitHubWorkflowRun[] | null): WorkflowHealth {
  if (!runs) return { availability: "unavailable", total: 0, successful: 0, failed: 0, inProgress: 0, latest: [] };
  const latest = runs.slice(0, 10).map((run) => ({
    id: run.id,
    name: run.display_title || run.name || "Workflow run",
    status: run.status || "unknown",
    conclusion: run.conclusion ?? null,
    updatedAt: run.updated_at ?? null,
    branch: run.head_branch ?? null,
    event: run.event ?? null,
  }));
  return {
    availability: "available",
    total: latest.length,
    successful: latest.filter((run) => run.conclusion === "success").length,
    failed: latest.filter((run) => ["failure", "cancelled", "timed_out", "action_required"].includes(run.conclusion ?? "")).length,
    inProgress: latest.filter((run) => !run.conclusion && ["queued", "in_progress", "waiting", "pending", "requested"].includes(run.status)).length,
    latest,
  };
}

function safePath(value: string | null) {
  const path = (value ?? "").trim().replace(/^\/+/, "");
  if (!path || path.length > 500 || path.includes("..") || path.includes("\\")) return "";
  return path;
}

function isSourceFile(path: string) {
  return /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|rb|php|cs|swift|vue|svelte|html|css|scss|sql)$/i.test(path);
}

function summarizeTree(tree: GitHubTreeItem[], repository: GitHubRepository, selectedPath: string, workflowHealth: WorkflowHealth) {
  const files = tree.filter((item) => item.type === "blob").map((item) => item.path);
  const topLevel = [...new Set(files.map((path) => path.split("/")[0]).filter(Boolean))].slice(0, 30);
  const manifests = files.filter((path) => /(?:^|\/)(package\.json|pnpm-lock\.yaml|yarn\.lock|package-lock\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|Dockerfile|docker-compose\.ya?ml)$/i.test(path));
  const workflows = files.filter((path) => /^\.github\/workflows\/.+\.ya?ml$/i.test(path));
  const testFiles = files.filter((path) => /(?:^|\/)(?:__tests__\/|.*(?:\.test|\.spec)\.[cm]?[jt]sx?$|test_.*\.py$|.*_test\.go$)/i.test(path));
  const sourceFiles = files.filter(isSourceFile);
  const folders = [...new Set(files.map((path) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "root"))].slice(0, 80);

  const impact = selectedPath
    ? buildImpact(selectedPath, files, manifests, workflows, testFiles)
    : null;

  return {
    repository: repository.full_name,
    defaultBranch: repository.default_branch,
    private: repository.private,
    writeAvailable: repository.permissions?.push === true,
    primaryLanguage: repository.language ?? null,
    updatedAt: repository.updated_at ?? null,
    totalFiles: files.length,
    sourceFiles: sourceFiles.length,
    topLevel,
    manifests,
    workflows,
    testFiles: testFiles.slice(0, 40),
    folders,
    impact,
    workflowHealth,
  };
}

function buildImpact(path: string, files: string[], manifests: string[], workflows: string[], testFiles: string[]) {
  const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "root";
  const nearbyFiles = files
    .filter((candidate) => (directory === "root" ? !candidate.includes("/") : candidate.startsWith(`${directory}/`)))
    .filter((candidate) => candidate !== path)
    .slice(0, 30);
  const relatedTests = testFiles.filter((test) => {
    const basename = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    return test.includes(basename) || (directory !== "root" && test.startsWith(`${directory}/`));
  }).slice(0, 12);

  const concerns: string[] = [];
  if (manifests.includes(path)) concerns.push("Dependency or runtime configuration may affect the whole project.");
  if (workflows.includes(path)) concerns.push("Deployment or continuous-integration behavior may change.");
  if (/^app\/api\/|^pages\/api\/|\/route\.[cm]?[jt]s$/i.test(path)) concerns.push("This appears to be a server endpoint; validate authentication, inputs, and error handling.");
  if (/migrations\/|\.sql$/i.test(path)) concerns.push("This appears to affect database schema or data; require explicit approval before applying it.");
  if (/\.github\//i.test(path)) concerns.push("Repository automation configuration may be affected; review permissions before merging.");
  if (!concerns.length) concerns.push("Review nearby modules and run the available focused tests before approving a change.");

  return { path, directory, nearbyFiles, relatedTests, concerns };
}

/**
 * Read-only, on-demand repository analysis. It returns metadata and paths only,
 * never stores raw repository contents or GitHub output in Nexo memory.
 */
export async function GET(request: NextRequest) {
  const verified = await requireVerifiedUser(request);
  if (verified.response) return verified.response;

  const requestedPath = safePath(request.nextUrl.searchParams.get("path"));
  try {
    const admin = getDevelopmentIntelligenceAdmin();
    const { data: connection, error: connectionError } = await admin
      .from("github_connections")
      .select("access_token, selected_repo")
      .eq("user_id", verified.user.id)
      .maybeSingle();

    if (connectionError || !connection?.selected_repo) {
      return NextResponse.json({ error: "Connect GitHub and choose a repository first." }, { status: 404 });
    }

    const token = resolveGithubOAuthToken(connection.access_token);
    if (!token) return NextResponse.json({ error: "Reconnect GitHub to analyze this repository." }, { status: 401 });

    const repoResponse = await fetch(`https://api.github.com/repos/${connection.selected_repo}`, {
      headers: githubApiHeaders(token), cache: "no-store",
    });
    const repository = (await repoResponse.json().catch(() => null)) as GitHubRepository | null;
    if (!repoResponse.ok || !repository?.default_branch) {
      return NextResponse.json({ error: "The selected repository is unavailable. Reconnect GitHub or choose another repository." }, { status: 502 });
    }

    const treeResponse = await fetch(
      `https://api.github.com/repos/${connection.selected_repo}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`,
      { headers: githubApiHeaders(token), cache: "no-store" },
    );
    const treePayload = (await treeResponse.json().catch(() => null)) as { tree?: GitHubTreeItem[]; truncated?: boolean } | null;
    if (!treeResponse.ok || !Array.isArray(treePayload?.tree)) {
      return NextResponse.json({ error: "Unable to read the repository structure right now." }, { status: 502 });
    }

    // Workflow health is optional read-only metadata. A repository can still be analyzed
    // when Actions access is unavailable, and no response data is persisted.
    const workflowResponse = await fetch(
      `https://api.github.com/repos/${connection.selected_repo}/actions/runs?per_page=10`,
      { headers: githubApiHeaders(token), cache: "no-store" },
    );
    const workflowPayload = (await workflowResponse.json().catch(() => null)) as { workflow_runs?: GitHubWorkflowRun[] } | null;
    const workflowHealth = summarizeWorkflowHealth(
      workflowResponse.ok && Array.isArray(workflowPayload?.workflow_runs) ? workflowPayload.workflow_runs : null,
    );

    return NextResponse.json({
      analysis: summarizeTree(treePayload.tree, repository, requestedPath, workflowHealth),
      truncated: treePayload.truncated === true,
      retention: "No repository contents or analysis output were saved.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Repository analysis failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to analyze the selected repository right now." }, { status: 500 });
  }
}
