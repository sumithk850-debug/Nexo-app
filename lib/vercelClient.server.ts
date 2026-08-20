import "server-only";
import { createClient } from "@supabase/supabase-js";
import { decryptIntegrationToken } from "@/lib/integrationToken.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export interface VercelConnection {
  userId: string;
  username: string | null;
  accessToken: string;
}

/**
 * Resolves a decrypted Vercel access token for a NEXO user. Returns null when
 * the user has no Vercel connection. Throws only on infrastructure failures,
 * never on a bad stored secret (that is reported as disconnected).
 */
export async function getVercelConnection(userId: string): Promise<VercelConnection | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("vercel_connections")
    .select("vercel_username, access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.access_token) return null;

  try {
    const accessToken = decryptIntegrationToken(data.access_token);
    return {
      userId,
      username: data.vercel_username ?? null,
      accessToken,
    };
  } catch {
    return null;
  }
}

export interface VercelApiOptions {
  /** Omit for a personal Vercel account; provide for a resolved team scope. */
  teamId?: string | null;
  accessToken: string;
}

export interface VercelScope {
  kind: "personal" | "team";
  teamId: string | null;
  label: string;
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  productionUrl: string | null;
}

export interface ScopedVercelProject extends VercelProject {
  scope: VercelScope;
}

export interface AccessibleVercelProjects {
  projects: ScopedVercelProject[];
  checkedScopes: number;
  inaccessibleScopes: number;
}

/**
 * Thin wrapper around Vercel's REST API. It uses only the authenticated
 * user's OAuth token. Read operations are the default; promotion remains a
 * separate approval-gated action at its route boundary.
 */
export class VercelClient {
  constructor(private options: VercelApiOptions) {}

  private async request(path: string, init?: RequestInit) {
    const url = new URL(`https://api.vercel.com${path}`);
    if (this.options.teamId) {
      url.searchParams.set("teamId", this.options.teamId);
    }
    const res = await fetch(url.toString(), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new VercelApiError(res.status, text);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Lists the first 100 teams available to the connected account. */
  async listTeams(): Promise<VercelScope[]> {
    const data = await this.request("/v2/teams?limit=100");
    const teams = Array.isArray(data.teams) ? data.teams : [];
    return teams.flatMap((team) => {
      if (!team || typeof team !== "object" || Array.isArray(team)) return [];
      const item = team as Record<string, unknown>;
      if (typeof item.id !== "string") return [];
      const label = typeof item.name === "string" && item.name.trim() ? item.name : "Vercel team";
      return [{ kind: "team" as const, teamId: item.id, label }];
    });
  }

  /** Lists projects visible in this exact account or team scope. */
  async listProjects(): Promise<VercelProject[]> {
    const data = await this.request("/v10/projects?limit=100");
    const projects = Array.isArray(data.projects) ? data.projects : [];
    return projects.flatMap((project) => {
      if (!project || typeof project !== "object" || Array.isArray(project)) return [];
      const item = project as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.name !== "string") return [];
      return [{
        id: item.id,
        name: item.name,
        framework: typeof item.framework === "string" ? item.framework : null,
        productionUrl: typeof item.productionUrl === "string" ? item.productionUrl : null,
      }];
    });
  }

  /** Lists recent deployments for a project in this exact account or team scope. */
  async listDeployments(projectId: string) {
    const data = await this.request(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=25`);
    const deployments = Array.isArray(data.deployments) ? data.deployments : [];
    return deployments.flatMap((deployment) => {
      if (!deployment || typeof deployment !== "object" || Array.isArray(deployment)) return [];
      const item = deployment as Record<string, unknown>;
      if (typeof item.id !== "string") return [];
      const meta = item.meta && typeof item.meta === "object" && !Array.isArray(item.meta)
        ? item.meta as Record<string, unknown>
        : null;
      return [{
        id: item.id,
        url: typeof item.url === "string" ? item.url : null,
        readyState: typeof item.readyState === "string" ? item.readyState : null,
        createdAt: typeof item.createdAt === "number" ? item.createdAt : null,
        meta: meta ? { gitCommitMessage: typeof meta.gitCommitMessage === "string" ? meta.gitCommitMessage : null } : null,
        isProduction: Array.isArray(item.targets) && item.targets.includes("production"),
        projectId: typeof item.projectId === "string" ? item.projectId : null,
        ready: item.ready === true,
      }];
    });
  }

  /** Build events (build log lines) for a deployment. */
  async buildEvents(deploymentId: string) {
    const data = await this.request(`/v2/deployments/${encodeURIComponent(deploymentId)}/events`);
    const builds = Array.isArray(data.builds) ? data.builds : [];
    const lambdas = Array.isArray(data.lambdas) ? data.lambdas : [];
    return {
      build: builds.flatMap((build) => {
        if (!build || typeof build !== "object" || Array.isArray(build)) return [];
        const logs = (build as Record<string, unknown>).logs;
        return Array.isArray(logs) ? logs : [];
      }),
      lambdas: lambdas.flatMap((lambda) => {
        if (!lambda || typeof lambda !== "object" || Array.isArray(lambda)) return [];
        const logs = (lambda as Record<string, unknown>).logs;
        return Array.isArray(logs) ? logs : [];
      }),
    };
  }

  /** Promote a deployment to production (write — must be approval-gated). */
  async promoteDeployment(deploymentId: string) {
    return this.request(`/v13/deployments/${encodeURIComponent(deploymentId)}/promote`, {
      method: "POST",
    });
  }
}

/**
 * Reads project inventories across the personal account plus every team that
 * the authenticated account exposes. A forbidden scope is recorded rather
 * than treated as an empty account, and its raw provider response is never
 * sent to the browser.
 */
export async function listAccessibleVercelProjects(accessToken: string): Promise<AccessibleVercelProjects> {
  const personalScope: VercelScope = { kind: "personal", teamId: null, label: "Personal account" };
  const personalClient = new VercelClient({ accessToken });

  let teamScopes: VercelScope[] = [];
  try {
    teamScopes = await personalClient.listTeams();
  } catch {
    // Listing teams is optional for a valid personal account; the per-scope
    // reads below still establish whether any accessible projects exist.
  }

  const scopes = [personalScope, ...teamScopes];
  const settled = await Promise.all(
    scopes.map(async (scope) => {
      try {
        const projects = await new VercelClient({ accessToken, teamId: scope.teamId }).listProjects();
        return { scope, projects, accessible: true };
      } catch {
        return { scope, projects: [] as VercelProject[], accessible: false };
      }
    })
  );

  const projects = settled.flatMap(({ scope, projects }) => projects.map((project) => ({ ...project, scope })));
  return {
    projects,
    checkedScopes: settled.length,
    inaccessibleScopes: settled.filter((result) => !result.accessible).length,
  };
}

export class VercelApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`Vercel API error ${status}: ${message}`);
    this.status = status;
  }
}
