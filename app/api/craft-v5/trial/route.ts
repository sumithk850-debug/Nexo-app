import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { getCraftV5TokenWindow, getCraftV5Trial, startCraftV5Trial } from "@/lib/craftV5Trial.server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const verified = await requireVerifiedUser(req, userId);
  if (verified.response) return verified.response;

  try {
    const trial = await getCraftV5Trial(verified.user.id);
    const tokenWindow = await getCraftV5TokenWindow(verified.user.id);
    return NextResponse.json({ trial, tokenWindow }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Craft V5 trial status failed", error);
    return NextResponse.json({ error: "Craft V5 trial status is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let claimedUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    claimedUserId = typeof body.userId === "string" ? body.userId : null;
  } catch {
    // Empty body is valid; identity is still taken from the bearer token.
  }
  const verified = await requireVerifiedUser(req, claimedUserId);
  if (verified.response) return verified.response;

  try {
    const trial = await startCraftV5Trial(verified.user.id);
    const tokenWindow = await getCraftV5TokenWindow(verified.user.id);
    return NextResponse.json({ trial, tokenWindow }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Craft V5 trial activation failed", error);
    return NextResponse.json({ error: "Craft V5 trial could not be activated." }, { status: 503 });
  }
}
