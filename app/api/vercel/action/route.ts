import { NextRequest } from "next/server";
import { getVercelConnection, VercelClient, VercelApiError } from "@/lib/vercelClient.server";

export const runtime = "nodejs";

/**
 * Approval-gated Vercel write actions. The caller (the approval card UI) is
 * responsible for showing the confirmation to the user first; this endpoint
 * only executes the whitelisted action and reports the outcome. It never
 * reads or returns any secret.
 *
 * Body: { action: "promote", payload: { projectId, deploymentId } }
 */
const ALLOWED_ACTIONS = ["promote"] as const;
type VercelAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !ALLOWED_ACTIONS.includes(body.action as VercelAction)) {
    return new Response(JSON.stringify({ error: "Unsupported or missing action" }), { status: 400 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
  }

  const connection = await getVercelConnection(userId);
  if (!connection) {
    return new Response(JSON.stringify({ error: "Not connected to Vercel" }), { status: 404 });
  }

  const { projectId, deploymentId } = body.payload ?? {};
  if (!projectId || !deploymentId) {
    return new Response(JSON.stringify({ error: "Missing projectId or deploymentId" }), { status: 400 });
  }

  try {
    const teamId = await resolveTeamId(connection.accessToken);
    if (!teamId) {
      return new Response(JSON.stringify({ error: "Could not resolve your Vercel team" }), { status: 404 });
    }

    const client = new VercelClient({ teamId, accessToken: connection.accessToken });
    const result = await client.promoteDeployment(deploymentId);
    return new Response(
      JSON.stringify({ success: true, action: body.action, result: { deploymentId, promoted: true, detail: result } }),
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof VercelApiError) {
      return new Response(JSON.stringify({ error: `Vercel rejected this action (HTTP ${err.status})` }), {
        status: err.status,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Action failed", detail: message }), { status: 500 });
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
