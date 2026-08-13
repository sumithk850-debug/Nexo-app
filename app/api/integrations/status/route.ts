import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  let github = {
    connected: false,
    username: null as string | null,
    canWrite: false,
    selectedRepo: null as string | null,
  };

  if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("github_connections")
      .select("github_username, access_token, selected_repo")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      github = {
        connected: true,
        username: data.github_username ?? null,
        canWrite: Boolean(data.access_token),
        selectedRepo: data.selected_repo ?? null,
      };
    }
  }

  return Response.json({
    github,
    // These cards report only whether this deployment has the credentials that
    // enable future read-only integrations. They do not make external changes.
    vercel: { connected: Boolean(process.env.VERCEL_TOKEN) },
    supabase: {
      connected: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
    },
  });
}
