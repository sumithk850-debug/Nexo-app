import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const installationId = req.nextUrl.searchParams.get("installation_id");
  const setupAction = req.nextUrl.searchParams.get("setup_action");
  const userId = req.nextUrl.searchParams.get("state");

  const origin = req.nextUrl.origin;

  if (!userId) {
    return NextResponse.redirect(`${origin}/?github=error&reason=missing_state`);
  }

  const supabase = getSupabaseAdmin();

  // If the user completed a GitHub App installation (installation_id present)
  if (installationId) {
    await supabase
      .from("github_connections")
      .update({ installation_id: installationId })
      .eq("user_id", userId);

    return NextResponse.redirect(`${origin}/?github=connected&mode=app&setup=${setupAction ?? "installed"}`);
  }

  // If code is returned, handle standard OAuth callback fallback
  if (!code) {
    return NextResponse.redirect(`${origin}/?github=error&reason=no_code`);
  }

  // Standard OAuth callback logic if needed
  return NextResponse.redirect(`${origin}/?github=connected&mode=oauth`);
}
