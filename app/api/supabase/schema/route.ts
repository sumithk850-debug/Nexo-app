import { NextRequest } from "next/server";
import { getSupabaseConnection, SupabaseClient, SupabaseApiError } from "@/lib/supabaseClient.server";

export const runtime = "nodejs";

/**
 * Read-only schema view for the connected user's Supabase project:
 *   GET ?userId=...&projectId=...            → tables + policies
 *   GET ?userId=...&projectId=...&table=...  → columns of one table
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return new Response(JSON.stringify({ error: "Missing projectId" }), { status: 400 });
  }

  const connection = await getSupabaseConnection(userId);
  if (!connection) {
    return new Response(JSON.stringify({ error: "Not connected to Supabase" }), { status: 404 });
  }

  try {
    const client = new SupabaseClient({ accessToken: connection.accessToken });

    const table = req.nextUrl.searchParams.get("table");
    if (table) {
      const [columns] = await Promise.all([client.listTableColumns(projectId, table)]);
      return new Response(JSON.stringify({ columns }), { status: 200 });
    }

    const [tables, policies] = await Promise.all([client.listTables(projectId), client.listPolicies(projectId)]);
    return new Response(JSON.stringify({ tables, policies }), { status: 200 });
  } catch (err) {
    if (err instanceof SupabaseApiError) {
      return new Response(JSON.stringify({ error: `Supabase rejected this request (HTTP ${err.status})` }), {
        status: err.status,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Could not reach Supabase", detail: message }), { status: 502 });
  }
}
