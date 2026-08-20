import { NextRequest } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { getVercelConnection, VercelClient } from "@/lib/vercelClient.server";
import { parseVercelReadToolIntent } from "@/lib/vercelToolParser";

export const runtime = "nodejs";

/**
 * Executes only the small Vercel read vocabulary used by chat. This route has
 * no mutation capability and always resolves the OAuth connection by verified
 * Nexo user ID, never from client-provided credentials.
 */
export async function POST(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return Response.json({ error: "Missing user ID." }, { status: 400 });

  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const body = await req.json().catch(() => null);
  const intent = parseVercelReadToolIntent(body);
  if (!intent) return Response.json({ error: "Unsupported Vercel read request." }, { status: 400 });

  const connection = await getVercelConnection(verified.user.id);
  if (!connection) return Response.json({ error: "Connect Vercel before requesting live account data." }, { status: 404 });

  try {
    const teamId = await resolveTeamId(connection.accessToken);
    const client = new VercelClient({ accessToken: connection.accessToken, teamId });

    if (intent.tool === "list_projects") {
      const projects = await client.listProjects();
      return Response.json({
        scope: teamId ? "team" : "personal",
        projects: projects.slice(0, 50),
      });
    }

    const deployments = await client.listDeployments(intent.projectId);
    return Response.json({
      projectId: intent.projectId,
      deployments: deployments.slice(0, 25),
    });
  } catch {
    // Do not return provider error bodies because they can contain connection
    // metadata. The chat continuation receives only this safe failure state.
    return Response.json({ error: "The live Vercel read could not be completed." }, { status: 502 });
  }
}

async function resolveTeamId(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.vercel.com/v0/teams", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    const team = Array.isArray(data?.teams) ? data.teams[0] : null;
    return typeof team?.id === "string" ? team.id : null;
  } catch {
    return null;
  }
}
