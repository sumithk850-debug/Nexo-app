import { NextRequest } from "next/server";
import { getVercelConnection, VercelClient } from "@/lib/vercelClient.server";

export const runtime = "nodejs";

/**
 * Read-only view of the connected user's Vercel account:
 *   GET ?userId=...&projects            → teams + projects
 *   GET ?userId=...&events&deploymentId → build events for one deployment
 *   GET ?userId=... (default)           → teams + projects + recent deployments
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  const connection = await getVercelConnection(userId);
  if (!connection) {
    return new Response(JSON.stringify({ error: "Not connected to Vercel" }), { status: 404 });
  }

  try {
    // Vercel personal accounts may not have any team. API endpoints work at
    // account scope when teamId is omitted, so a missing team must not block a
    // valid OAuth connection from listing its projects or deployments.
    const teamId = await resolveTeamId(connection.accessToken);
    const client = new VercelClient({ teamId, accessToken: connection.accessToken });
    const projects = await client.listProjects();

    if (req.nextUrl.searchParams.has("projects")) {
      return new Response(JSON.stringify({ teamId, projects }), { status: 200 });
    }

    if (req.nextUrl.searchParams.has("events")) {
      const deploymentId = req.nextUrl.searchParams.get("deploymentId");
      if (!deploymentId) {
        return new Response(JSON.stringify({ error: "Missing deploymentId" }), { status: 400 });
      }
      const events = await client.buildEvents(deploymentId);
      return new Response(JSON.stringify({ events }), { status: 200 });
    }

    const deploymentsByProject: Record<string, unknown[]> = {};
    for (const project of projects) {
      try {
        deploymentsByProject[project.id] = await client.listDeployments(project.id);
      } catch {
        deploymentsByProject[project.id] = [];
      }
    }

    return new Response(JSON.stringify({ teamId, scope: teamId ? "team" : "personal", projects, deployments: deploymentsByProject }), {
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Could not reach Vercel", detail: message }), {
      status: 502,
    });
  }
}

async function resolveTeamId(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.vercel.com/v0/teams", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.teams?.[0]?.id ?? null;
}
