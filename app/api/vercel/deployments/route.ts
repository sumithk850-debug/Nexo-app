import { NextRequest } from "next/server";
import { getVercelConnection, listAccessibleVercelProjects, VercelClient, VercelScope } from "@/lib/vercelClient.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

/**
 * Read-only view of the connected user's Vercel account. Project discovery
 * spans the personal account and every team scope exposed by that OAuth token.
 * No provider error payload is returned to the browser.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "Missing user ID." }, { status: 400 });
  }
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  const connection = await getVercelConnection(verified.user.id);
  if (!connection) {
    return Response.json({ error: "Connect Vercel before viewing account data." }, { status: 404 });
  }

  try {
    const inventory = await listAccessibleVercelProjects(connection.accessToken);

    if (req.nextUrl.searchParams.has("projects")) {
      return Response.json(inventory);
    }

    if (req.nextUrl.searchParams.has("events")) {
      const deploymentId = req.nextUrl.searchParams.get("deploymentId");
      if (!deploymentId) {
        return Response.json({ error: "Missing deployment ID." }, { status: 400 });
      }
      const scopes = uniqueScopes(inventory.projects.map((project) => project.scope));
      for (const scope of scopes) {
        try {
          const events = await new VercelClient({ accessToken: connection.accessToken, teamId: scope.teamId }).buildEvents(deploymentId);
          return Response.json({ events });
        } catch {
          // A deployment is scoped. Continue only through scopes already
          // discovered for this same authenticated account.
        }
      }
      return Response.json({ error: "Build events are not available for this deployment." }, { status: 404 });
    }

    const deployments: Record<string, unknown[]> = {};
    for (const project of inventory.projects) {
      try {
        deployments[project.id] = await new VercelClient({
          accessToken: connection.accessToken,
          teamId: project.scope.teamId,
        }).listDeployments(project.id);
      } catch {
        // One inaccessible deployment history cannot hide an otherwise valid
        // project inventory. The panel renders a harmless empty state.
        deployments[project.id] = [];
      }
    }

    return Response.json({ ...inventory, deployments });
  } catch {
    return Response.json({ error: "The Vercel project list could not be loaded." }, { status: 502 });
  }
}

function uniqueScopes(scopes: VercelScope[]): VercelScope[] {
  const seen = new Set<string>();
  return scopes.filter((scope) => {
    const key = scope.teamId ?? "personal";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
