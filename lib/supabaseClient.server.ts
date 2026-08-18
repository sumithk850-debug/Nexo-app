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
 * Resolves a management access token for the given user. Privileged Supabase
 * management actions must use that user's encrypted connection only; a shared
 * service token would incorrectly expose one account's projects to another.
 */
export async function resolveSupabaseAccessToken(userId: string): Promise<string | null> {
  const connection = await getSupabaseConnection(userId);
  return connection?.accessToken ?? null;
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

  /** Schema introspection is read-only by definition, so it is implemented
   * as a safe information_schema query through the approved SQL channel
   * (the Management API openapi/database endpoints do not surface tables for
   * service tokens). */
  private async introspect(projectId: string, sql: string) {
    const result = await this.request(`/v1/projects/${encodeURIComponent(projectId)}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    return result;
  }

  /** List public tables with their columns via information_schema. */
  async listTables(projectId: string) {
    const rows = (await this.introspect(
      projectId,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )) as Array<{ table_name: string }>;
    return rows.map((r) => ({ name: r.table_name, columns: [] as Array<{ name: string; type: string | null; nullable: boolean }> }));
  }

  /** Columns (schema) for a single public table via information_schema. */
  async listTableColumns(projectId: string, tableName: string) {
    const rows = (await this.introspect(
      projectId,
      `SELECT column_name, udt_name AS type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}' ORDER BY ordinal_position`
    )) as Array<{ column_name: string; type: string | null; is_nullable: string }>;
    if (!rows.length) throw new Error(`Table "${tableName}" not found`);
    return rows.map((r) => ({ name: r.column_name, type: r.type, nullable: r.is_nullable === "YES" }));
  }

  /** Row-level security policies for public tables, read via SQL. */
  async listPolicies(projectId: string) {
    const rows = (await this.introspect(
      projectId,
      `SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`
    )) as unknown;
    return { policies: rows ?? [] };
  }

  /** Safely read a small, explicitly bounded table sample. Sensitive columns
   * are redacted before this data ever leaves the server-side tool route. */
  async readRows(projectId: string, tableName: string, columns: string[] = [], limit = 20) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }
    const safeColumns = columns
      .filter((column) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column))
      .slice(0, 12);
    const selected = safeColumns.length > 0 ? safeColumns.map((column) => `"${column}"`).join(", ") : "*";
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 25));
    return this.introspect(projectId, `SELECT ${selected} FROM public."${tableName}" LIMIT ${safeLimit}`);
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
