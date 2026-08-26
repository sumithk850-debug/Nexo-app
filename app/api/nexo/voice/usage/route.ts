import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { getNexoVoiceUsage } from "@/lib/nexoVoice.server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  try {
    const usage = await getNexoVoiceUsage(verified.user.id);
    return Response.json({ usage }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("NEXO Live usage lookup failed", {
      userId: verified.user.id,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return Response.json({ error: "NEXO Live usage is temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
