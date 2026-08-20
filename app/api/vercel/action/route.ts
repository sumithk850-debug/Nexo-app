import { NextRequest } from "next/server";
import { getVercelConnection, listAccessibleVercelProjects, VercelApiError, VercelClient } from "@/lib/vercelClient.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

/**
 * Approval-gated Vercel write actions. A matching approval card must be shown
 * by the client before this endpoint is called. The endpoint additionally
 * verifies that the requested project belongs to an accessible scope of the
 * authenticated user's OAuth connection before executing the whitelisted
 * promotion action.
 */
const ALLOWED_ACTIONS = ["promote"] as const;
type VercelAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !ALLOWED_ACTIONS.includes(body.action as VercelAction)) {
    return Response.json({ error: "Unsupported or missing action." }, { status: 400 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "Missing user ID." }, { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const connection = await getVercelConnection(verified.user.id);
  if (!connection) {
    return Response.json({ error: "Connect Vercel before approving this action." }, { status: 404 });
  }

  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? body.payload as Record<string, unknown>
    : null;
  const projectId = typeof payload?.projectId === "string" ? payload.projectId : null;
  const deploymentId = typeof payload?.deploymentId === "string" ? payload.deploymentId : null;
  const requestedTeamId = typeof payload?.teamId === "string" ? payload.teamId : null;
  if (!projectId || !deploymentId) {
    return Response.json({ error: "Missing project or deployment ID." }, { status: 400 });
  }

  try {
    const inventory = await listAccessibleVercelProjects(connection.accessToken);
    const project = inventory.projects.find(
      (candidate) => candidate.id === projectId && candidate.scope.teamId === requestedTeamId
    );
    if (!project) {
      return Response.json({ error: "That project is not available in the connected account." }, { status: 404 });
    }

    await new VercelClient({
      accessToken: connection.accessToken,
      teamId: project.scope.teamId,
    }).promoteDeployment(deploymentId);

    return Response.json({
      success: true,
      action: body.action,
      result: { deploymentId, promoted: true },
    });
  } catch (error) {
    if (error instanceof VercelApiError) {
      return Response.json({ error: `Vercel rejected this action (HTTP ${error.status}).` }, { status: error.status });
    }
    return Response.json({ error: "The approved action could not be completed." }, { status: 502 });
  }
}
