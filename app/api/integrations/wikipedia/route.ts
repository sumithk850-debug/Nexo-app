import { NextRequest, NextResponse } from "next/server";
import { getWikipediaEnabled, setWikipediaEnabled } from "@/lib/wikipediaGate.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const verified = requestedUserId ? await requireVerifiedUser(req, requestedUserId) : null;
  if (verified?.response) return verified.response;
  if (!verified?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  return NextResponse.json({ enabled: await getWikipediaEnabled(verified.user.id) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const requestedUserId = typeof body?.userId === "string" ? body.userId : null;
  const verified = requestedUserId ? await requireVerifiedUser(req, requestedUserId) : null;
  if (verified?.response) return verified.response;
  if (!verified?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  try {
    const enabled = await setWikipediaEnabled(verified.user.id, body.enabled);
    return NextResponse.json({ enabled }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Wikipedia preference update failed:", error);
    return NextResponse.json({ error: "Wikipedia preference could not be saved." }, { status: 500 });
  }
}
