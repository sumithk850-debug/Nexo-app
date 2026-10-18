import { NextRequest } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { buildPresentationArtifact } from "@/lib/presentationBuilder.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const verified = await requireVerifiedUser(req);
  if ("response" in verified) return verified.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const prompt = typeof (body as { prompt?: unknown })?.prompt === "string" ? (body as { prompt: string }).prompt.trim() : "";
  if (!prompt || prompt.length > 4000) return Response.json({ error: "Please provide a presentation brief under 4,000 characters." }, { status: 400 });

  try {
    const artifact = await buildPresentationArtifact(prompt);
    return Response.json({ artifact }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Presentation artifact generation failed", error);
    return Response.json({ error: "The presentation could not be generated. Please try again." }, { status: 500 });
  }
}
