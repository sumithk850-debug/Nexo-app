import { NextRequest } from "next/server";
import { SupabaseClient, SupabaseApiError } from "@/lib/supabaseClient.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

/**
 * Approval-gated SQL execution. The caller (the approval card UI) is
 * responsible for showing the statement summary to the user first; this
 * endpoint only executes the whitelisted "sql" action on the user's own
 * project and reports the outcome. Destructive schema-level operations
 * (DROP DATABASE / role changes) are blocked server-side.
 *
 * Body: { action: "sql", payload: { projectId, sql } }
 */
const ALLOWED_ACTIONS = ["sql"] as const;
type SupabaseAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !ALLOWED_ACTIONS.includes(body.action as SupabaseAction)) {
    return new Response(JSON.stringify({ error: "Unsupported or missing action" }), { status: 400 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  let client: SupabaseClient;
  try {
    client = await SupabaseClient.forUser(verified.user.id);
  } catch {
    return new Response(JSON.stringify({ error: "Not connected to Supabase" }), { status: 404 });
  }

  const { projectId, sql } = body.payload ?? {};
  if (!projectId || !sql) {
    return new Response(JSON.stringify({ error: "Missing projectId or sql" }), { status: 400 });
  }

  try {
    const projects = await client.listProjects() as Array<{ id?: string }>;
    if (!projects.some((project) => project.id === projectId)) {
      return new Response(JSON.stringify({ error: "The selected Supabase project is not available to this connection" }), { status: 403 });
    }
    const result = await client.executeSql(projectId, sql);
    return new Response(
      JSON.stringify({ success: true, action: "sql", result }),
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof SupabaseApiError) {
      return new Response(JSON.stringify({ error: `Supabase rejected this statement (HTTP ${err.status})` }), {
        status: err.status,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "SQL execution failed", detail: message }), { status: 500 });
  }
}
