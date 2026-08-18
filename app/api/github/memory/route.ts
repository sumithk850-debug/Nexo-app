import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Repository writes are performed only by the approval-gated commit route.
 * Automatic conversation mirroring was retired because it could create commits
 * without an explicit user approval card.
 */
export async function POST(_request: NextRequest) {
  return Response.json(
    { error: "Automatic GitHub memory writes are disabled. Repository changes require explicit approval." },
    { status: 410 }
  );
}
