import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptIntegrationToken } from "@/lib/integrationToken.server";
import {
  createInstallationAccessToken,
  githubApiHeaders,
  isGitHubAppConfigured,
} from "@/lib/githubApp.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function checkGitHubConnection(userId: string) {
  const { data } = await getSupabaseAdmin()
    .from("github_connections")
    .select("github_username, selected_repo, installation_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return { connected: false, username: null as string | null, canWrite: false, selectedRepo: null as string | null };
  }

  let canWrite = false;
  if (data.installation_id && isGitHubAppConfigured()) {
    try {
      const { token } = await createInstallationAccessToken(data.installation_id);
      if (!data.selected_repo) {
        canWrite = true;
      } else {
        const response = await fetch(`https://api.github.com/repos/${data.selected_repo}`, {
          headers: githubApiHeaders(token),
          cache: "no-store",
        });
        if (response.ok) {
          const repository = (await response.json()) as { permissions?: { push?: boolean } };
          canWrite = repository.permissions?.push !== false;
        }
      }
    } catch {
      canWrite = false;
    }
  }

  return {
    connected: true,
    username: data.github_username ?? null,
    canWrite,
    selectedRepo: data.selected_repo ?? null,
  };
}

export async function GET(req: NextRequest) {
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const verified = requestedUserId ? await requireVerifiedUser(req, requestedUserId) : null;
  if (verified?.response) return verified.response;
  const userId = verified?.user.id ?? null;

  const github = userId
    ? await checkGitHubConnection(userId)
    : { connected: false, username: null, canWrite: false, selectedRepo: null };

  const vercel = userId
    ? await checkVercelConnection(userId)
    : { connected: Boolean(process.env.VERCEL_TOKEN), username: null };

  const supabase = userId
    ? await checkSupabaseConnection(userId)
    : {
        connected: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
        username: null,
      };

  return Response.json({ github, vercel, supabase });
}

async function checkVercelConnection(userId: string) {
  const { data } = await getSupabaseAdmin()
    .from("vercel_connections")
    .select("vercel_username, access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.access_token) return { connected: false, username: null as string | null };

  try {
    const token = decryptIntegrationToken(data.access_token);
    const response = await fetch("https://api.vercel.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return { connected: false, username: null };
    const info = await response.json();
    return { connected: true, username: (info?.email as string | null) ?? data.vercel_username ?? null };
  } catch {
    return { connected: false, username: null };
  }
}

async function checkSupabaseConnection(userId: string) {
  let token: string | null = null;
  try {
    const connection = await getSupabaseAdmin()
      .from("supabase_connections")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();
    token = connection.data?.access_token ? decryptIntegrationToken(connection.data.access_token) : null;
  } catch {
    return { connected: false, username: null as string | null };
  }
  if (!token) return { connected: false, username: null as string | null };

  try {
    const response = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return { connected: false, username: null };
    const projects = (await response.json()) as Array<{ id: string; name?: string }> | undefined;
    return {
      connected: true,
      username: (projects?.[0]?.name as string | null) ?? "nexo-app",
    };
  } catch {
    return { connected: false, username: null };
  }
}
