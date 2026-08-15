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

  const vercel = userId
    ? await checkVercelConnection(userId)
    : { connected: Boolean(process.env.VERCEL_TOKEN), username: null };

  const supabaseInfo = userId
    ? await checkSupabaseConnection(userId)
    : {
        connected: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
        username: null,
      };

  return Response.json({
    github,
    vercel,
    supabase: supabaseInfo,
  });
}

async function checkVercelConnection(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("vercel_connections")
    .select("vercel_username, access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.access_token) return { connected: false, username: null as string | null };

  try {
    const { decryptIntegrationToken } = await import("@/lib/integrationToken.server");
    const token = decryptIntegrationToken(data.access_token);
    const res = await fetch("https://api.vercel.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { connected: false, username: null };
    const info = await res.json();
    return { connected: true, username: (info?.email as string | null) ?? data.vercel_username ?? null };
  } catch {
    return { connected: false, username: null };
  }
}

async function checkSupabaseConnection(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("supabase_connections")
    .select("supabase_username, access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.access_token) return { connected: false, username: null as string | null };

  try {
    const { decryptIntegrationToken } = await import("@/lib/integrationToken.server");
    const token = decryptIntegrationToken(data.access_token);
    const res = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { connected: false, username: null };
    const projects = (await res.json()) as Array<{ id: string; name?: string }> | undefined;
    return {
      connected: true,
      username: (projects?.[0]?.name as string | null) ?? data.supabase_username ?? null,
    };
  } catch {
    return { connected: false, username: null };
  }
}
