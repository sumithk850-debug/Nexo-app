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
 * Thin wrapper around the Supabase Management API for per-user access.
 * All schema inspection is read-only; SQL execution is intentionally exposed
 * separately so the approval card UI stays in control of every write.
 */
export class SupabaseClient {
  constructor(private options: SupabaseClientOptions) {}

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

  /** List tables of a project's Postgres database. */
  async listTables(projectId: string) {
    return this.request(`/v1/database/${encodeURIComponent(projectId)}/tables`);
  }

  /** Columns (schema) for a single table. */
  async listTableColumns(projectId: string, tableName: string) {
    return this.request(
      `/v1/database/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(tableName)}/columns`
    );
  }

  /** List row-level security policies of a project. */
  async listPolicies(projectId: string) {
    return this.request(`/v1/database/${encodeURIComponent(projectId)}/policies`);
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
    return this.request(`/v1/sql/${encodeURIComponent(projectId)}`, {
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
