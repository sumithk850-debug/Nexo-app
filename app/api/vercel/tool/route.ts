import { NextRequest } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { getVercelConnection, listAccessibleVercelProjects, VercelClient } from "@/lib/vercelClient.server";
import { parseVercelReadToolIntent } from "@/lib/vercelToolParser";

export const runtime = "nodejs";

/**
 * Executes the deliberately small, read-only Vercel vocabulary used by chat.
 * The OAuth connection is resolved from the verified Nexo user, never from
 * client-provided credentials or a client-provided team scope.
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
    const inventory = await listAccessibleVercelProjects(connection.accessToken);

    if (intent.tool === "list_projects") {
      return Response.json({
        projects: inventory.projects.slice(0, 50),
        checkedScopes: inventory.checkedScopes,
        inaccessibleScopes: inventory.inaccessibleScopes,
      });
    }

    const project = inventory.projects.find((candidate) => candidate.id === intent.projectId);
    if (!project) {
      return Response.json({ error: "That project is not available in the connected account." }, { status: 404 });
    }

    const deployments = await new VercelClient({
      accessToken: connection.accessToken,
      teamId: project.scope.teamId,
    }).listDeployments(project.id);
    return Response.json({
      projectId: project.id,
      deployments: deployments.slice(0, 25),
    });
  } catch {
    // Provider payloads can include connection metadata and are never exposed
    // to the model or browser.
    return Response.json({ error: "The live Vercel read could not be completed." }, { status: 502 });
  }
}
