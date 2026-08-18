import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Personal-token connections have been retired. GitHub access is established
 * through the user OAuth flow, and repository writes require the user's
 * installed GitHub App permissions plus an explicit approval card.
 */
export async function POST(_req: NextRequest) {
  return Response.json(
    {
      error: "Direct GitHub token connections are no longer supported. Connect with GitHub, then enable Read & Write Access from Integrations.",
    },
    { status: 410 }
  );
}
