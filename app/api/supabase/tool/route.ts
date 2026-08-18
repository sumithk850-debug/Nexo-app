import { NextRequest } from "next/server";
import { SupabaseApiError, SupabaseClient } from "@/lib/supabaseClient.server";
import { SUPABASE_READ_TOOL_NAMES, type SupabaseReadToolIntent } from "@/lib/supabaseToolParser";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

const SENSITIVE_COLUMN = /(password|secret|token|api[_-]?key|access[_-]?key|refresh|authorization|email|phone|address|ssn|credit|card)/i;

function redactRows(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 25).map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [
      key,
      SENSITIVE_COLUMN.test(key) ? "[redacted]" : value,
    ]));
  });
}

async function verifyProject(client: SupabaseClient, projectId: string) {
  const projects = await client.listProjects() as Array<{ id?: string }>;
  if (!projects.some((project) => project.id === projectId)) {
    throw new SupabaseApiError(403, "The selected Supabase project is not available to this connection");
  }
}

export async function POST(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const intent = await req.json().catch(() => null) as SupabaseReadToolIntent | null;
  if (!userId || !intent || !SUPABASE_READ_TOOL_NAMES.includes(intent.tool)) {
    return new Response(JSON.stringify({ error: "Invalid Supabase read tool request" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  try {
    const client = await SupabaseClient.forUser(verified.user.id);
    if (intent.tool === "list_projects") {
      const projects = await client.listProjects() as Array<{ id?: string; name?: string; region?: string }>;
      return Response.json({
        ok: true,
        tool: intent.tool,
        projects: projects.filter((project) => project.id && project.name).slice(0, 25).map((project) => ({
          id: project.id,
          name: project.name,
          region: project.region ?? null,
        })),
      });
    }

    if (!intent.projectId) {
      return new Response(JSON.stringify({ error: "A verified projectId is required" }), { status: 400 });
    }
    await verifyProject(client, intent.projectId);

    if (intent.tool === "list_tables") {
      const [tables, policies] = await Promise.all([client.listTables(intent.projectId), client.listPolicies(intent.projectId)]);
      const policyCount = Array.isArray(policies.policies) ? policies.policies.length : 0;
      return Response.json({ ok: true, tool: intent.tool, projectId: intent.projectId, tables, policyCount });
    }
    if (intent.tool === "describe_table") {
      if (!intent.table) return new Response(JSON.stringify({ error: "A table name is required" }), { status: 400 });
      const columns = await client.listTableColumns(intent.projectId, intent.table);
      return Response.json({ ok: true, tool: intent.tool, projectId: intent.projectId, table: intent.table, columns });
    }
    if (intent.tool === "read_rows") {
      if (!intent.table) return new Response(JSON.stringify({ error: "A table name is required" }), { status: 400 });
      const rows = await client.readRows(intent.projectId, intent.table, intent.columns, intent.limit);
      return Response.json({ ok: true, tool: intent.tool, projectId: intent.projectId, table: intent.table, rows: redactRows(rows) });
    }
    return new Response(JSON.stringify({ error: "Unsupported Supabase read tool" }), { status: 400 });
  } catch (error) {
    if (error instanceof SupabaseApiError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown Supabase tool error";
    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }
}
