import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyOAuthState } from "@/lib/oauthState.server";

export const runtime = "nodejs";

const UPGRADE_STATE_COOKIE = "nexo_github_upgrade_state";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function backToApp(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/", req.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.set({ name: UPGRADE_STATE_COOKIE, value: "", path: "/api/github/app-callback", maxAge: 0 });
  return response;
}

export async function GET(req: NextRequest) {
  const installationId = req.nextUrl.searchParams.get("installation_id");
  const setupAction = req.nextUrl.searchParams.get("setup_action");
  const signedState = req.nextUrl.searchParams.get("state") ?? req.cookies.get(UPGRADE_STATE_COOKIE)?.value ?? null;
  const userId = verifyOAuthState(signedState, "github");

  if (!userId) return backToApp(req, { github: "error", reason: "invalid_upgrade_state" });
  if (!installationId || !/^\d+$/.test(installationId)) {
    return backToApp(req, { github: "error", reason: "missing_installation" });
  }

  // GitHub can call the setup URL after an installation is updated or suspended.
  // Only a completed installation is a usable write upgrade.
  if (setupAction === "suspend") {
    return backToApp(req, { github: "error", reason: "installation_suspended" });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("github_connections")
    .update({ installation_id: installationId })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (error || !data) {
    console.error("[github-app-callback] Could not save installation", error?.message);
    return backToApp(req, { github: "error", reason: "installation_save_failed" });
  }

  return backToApp(req, { github: "connected", mode: "app" });
}
