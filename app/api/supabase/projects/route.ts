import { NextRequest } from "next/server";
import { SupabaseApiError, SupabaseClient } from "@/lib/supabaseClient.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

/**
 * Returns the Supabase projects that the authenticated user's protected
 * connection can manage. This is a read-only discovery endpoint: callers must
 * use these returned IDs rather than guessing project context in chat or UI.
 */
export async function GET(req: NextRequest) {
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

  try {
    const projects = await client.listProjects() as Array<{
      id?: string;
      name?: string;
      region?: string;
      organization_id?: string;
    }>;
    const safeProjects = projects
      .filter((project) => Boolean(project.id && project.name))
      .map((project) => ({
        id: project.id!,
        name: project.name!,
        region: project.region ?? null,
      }));
    return new Response(JSON.stringify({ projects: safeProjects }), { status: 200 });
  } catch (err) {
    if (err instanceof SupabaseApiError) {
      return new Response(JSON.stringify({ error: `Supabase rejected this request (HTTP ${err.status})` }), {
        status: err.status,
      });
    }
    return new Response(JSON.stringify({ error: "Could not load Supabase projects" }), { status: 502 });
  }
}
