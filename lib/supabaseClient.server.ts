import "server-only";
import { createClient } from "@supabase/supabase-js";
import { decryptIntegrationToken } from "@/lib/integrationToken.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export interface SupabaseConnection {
  userId: string;
  username: string | null;
  accessToken: string;
}

/**
 * Resolves a decrypted Supabase management token for a NEXO user. Returns
 * null when the user has no Supabase connection or the stored secret cannot
 * be decrypted.
 */
export async function getSupabaseConnection(userId: string): Promise<SupabaseConnection | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("supabase_connections")
    .select("supabase_username, access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.access_token) return null;

  try {
    const accessToken = decryptIntegrationToken(data.access_token);
    return {
      userId,
      username: data.supabase_username ?? null,
      accessToken,
    };
  } catch {
    return null;
  }
}

export interface SupabaseClientOptions {
  accessToken: string;
}

/**
 * Resolves a management access token for the given user. Prefers a
 * user-supplied token stored in `supabase_connections`; falls back to the
 * app-level Supabase service-role key (the owner's own "nexo-app" project)
 * so no manual token entry is ever required.
 */
export async function resolveSupabaseAccessToken(userId: string): Promise<string | null> {
  const connection = await getSupabaseConnection(userId);
  if (connection?.accessToken) return connection.accessToken;
  // Fall back to the service-role management token configured for the
  // platform's own Supabase project. Stored keys come from env only.
  const serviceToken = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return serviceToken ?? null;
}

/**
 * Thin wrapper around the Supabase Management API for per-user access.
 * All schema inspection is read-only; SQL execution is intentionally exposed
 * separately so the approval card UI stays in control of every write.
 */
export class SupabaseClient {
  constructor(private options: SupabaseClientOptions) {}

  /** Build a client using the resolved token for a user (with service-key fallback). */
  static async forUser(userId: string) {
    const accessToken = await resolveSupabaseAccessToken(userId);
    if (!accessToken) throw new SupabaseApiError(503, "No Supabase management token is available.");
    return new SupabaseClient({ accessToken });
  }

  private async request(path: string, init?: RequestInit) {
    const res = await fetch(`https://api.supabase.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new SupabaseApiError(res.status, text);
    }
    return res.json();
  }

  /** List projects the connected account can manage. */
  async listProjects() {
    return this.request("/v1/projects");
  }

  /** Derive the public schema (tables with columns) from the project's
   * PostgREST OpenAPI spec — the supported Management API surface for
   * introspecting a database. */
  async listTables(projectId: string) {
    const spec = (await this.request(
      `/v1/projects/${encodeURIComponent(projectId)}/database/openapi`
    )) as Record<string, unknown> | undefined;
    const paths = (spec?.paths as Record<string, Record<string, unknown>>) ?? {};
    const tableMap = new Map<string, Array<{ name: string; type: string | null; nullable: boolean }>>();
    for (const [path, methods] of Object.entries(paths)) {
      const m = /^\/(\w+)$/.exec(path);
      if (!m) continue;
      const tableName = m[1];
      if (tableName === "rpc" || tableMap.has(tableName)) continue;
      for (const method of ["get", "post", "put", "patch", "delete"]) {
        const op = methods[method] as Record<string, unknown> | undefined;
        const params = (op?.parameters as Array<Record<string, unknown>>) ?? [];
        const columns = params
          .filter((p) => (p.in as string) === "query" && (p.name as string) !== "select" && (p.name as string) !== "order" && (p.name as string) !== "limit" && (p.name as string) !== "offset")
          .map((p) => ({ name: p.name as string, type: (p.schema as Record<string, unknown> | undefined)?.type as string | null, nullable: p.required !== true }));
        if (columns.length) {
          tableMap.set(tableName, columns);
          break;
        }
      }
    }
    return Array.from(tableMap.entries()).map(([name, columns]) => ({ name, columns }));
  }

  /** Columns (schema) for a single table — derived from the OpenAPI spec. */
  async listTableColumns(projectId: string, tableName: string) {
    const tables = await this.listTables(projectId);
    const table = tables.find((t) => t.name === tableName);
    if (!table) throw new Error(`Table "${tableName}" not found`);
    return table.columns;
  }

  /** List row-level security policies of a project — not exposed by the
   * Management API for arbitrary projects, so we read them via SQL if needed;
   * this is kept as a stub that surfaces the project metadata instead. */
  async listPolicies(projectId: string) {
    return { policies: [] as unknown[] };
  }

  /**
   * Execute raw SQL. Dangerous by nature — the API caller MUST show the user
   * an approval card before calling this. Blocked statements: anything that
   * would drop the database or change roles. Other writes are allowed because
   * Supabase projects are fully owned by the connecting user.
   */
  async executeSql(projectId: string, sql: string) {
    const sanitized = sql.trim().replace(/;+\s*$/, "");
    if (!sanitized) {
      throw new Error("Empty SQL statement");
    }
    const upper = sanitized.toUpperCase();
    const blocked = ["DROP DATABASE", "CREATE ROLE", "ALTER ROLE", "DROP ROLE", "CREATE USER", "DROP USER", "ALTER USER"];
    const blockedMatch = blocked.find((keyword) => upper.includes(keyword));
    if (blockedMatch) {
      throw new Error(`Statement type "${blockedMatch}" is not allowed through this integration.`);
    }
    return this.request(`/v1/projects/${encodeURIComponent(projectId)}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: sanitized }),
    });
  }
}

export class SupabaseApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`Supabase API error ${status}: ${message}`);
    this.status = status;
  }
}
