import "server-only";

import { createClient } from "@supabase/supabase-js";

export type VerifiedRequestUser = {
  id: string;
  email: string | null;
};

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Verifies a Supabase access token supplied through the standard Bearer header.
 * Privileged routes must never trust a browser-provided user ID by itself.
 */
export async function requireVerifiedUser(req: Request, claimedUserId?: string | null): Promise<
  | { user: VerifiedRequestUser; response?: never }
  | { user?: never; response: Response }
> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) {
    return { response: unauthorized("Sign in is required for this integration action.") };
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { response: unauthorized("Your sign-in session is not valid. Please sign in again.") };
  }
  if (claimedUserId && data.user.id !== claimedUserId) {
    return { response: unauthorized("The requested integration account does not match your signed-in user.") };
  }

  return { user: { id: data.user.id, email: data.user.email ?? null } };
}
