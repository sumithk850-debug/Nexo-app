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
  teamId: string;
  accessToken: string;
}

/**
 * Thin wrapper around the Vercel REST API. Uses the per-user OAuth access
 * token from the database; all calls are read-only by default.
 */
export class VercelClient {
  constructor(private options: VercelApiOptions) {}

  private async request(path: string, init?: RequestInit) {
    const url = new URL(`https://api.vercel.com${path}`);
    url.searchParams.set("teamId", this.options.teamId);
    const res = await fetch(url.toString(), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new VercelApiError(res.status, text);
    }
    return res.json();
  }

  /** List projects visible to the connected account. */
  async listProjects() {
    const data = await this.request("/v9/projects");
    return (data.projects ?? []).map((project: Record<string, unknown>) => ({
      id: project.id,
      name: project.name,
      framework: project.framework,
      productionUrl: project.productionUrl ?? null,
    }));
  }

  /** List recent deployments for a project. */
  async listDeployments(projectId: string) {
    const data = await this.request(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=25`);
    return (data.deployments ?? []).map((d: Record<string, unknown>) => ({
      id: d.id,
      url: d.url,
      readyState: d.readyState,
      createdAt: d.createdAt,
      meta: d.meta ? { gitCommitMessage: (d.meta as Record<string, unknown>)?.gitCommitMessage ?? null } : null,
      isProduction: Array.isArray(d.targets) && d.targets.includes("production"),
      projectId: d.projectId,
      ready: d.ready,
    }));
  }

  /** Build events (build log lines) for a deployment. */
  async buildEvents(deploymentId: string) {
    const data = await this.request(`/v2/deployments/${encodeURIComponent(deploymentId)}/events`);
    return {
      build: (data.builds ?? []).flatMap((build: Record<string, unknown>) => build.logs ?? []),
      lambdas: (data.lambdas ?? []).flatMap((lambda: Record<string, unknown>) => lambda.logs ?? []),
    };
  }

  /** Promote a deployment to production (write — must be approval-gated). */
  async promoteDeployment(deploymentId: string) {
    return this.request(`/v13/deployments/${encodeURIComponent(deploymentId)}/promote`, {
      method: "POST",
    });
  }
}

export class VercelApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`Vercel API error ${status}: ${message}`);
    this.status = status;
  }
}
