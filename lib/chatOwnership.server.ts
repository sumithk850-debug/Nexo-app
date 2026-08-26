import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type OwnedChat = {
  id: string;
  session_id: string;
  user_id: string | null;
};

/**
 * This client is server-only. Every query using it must include the verified
 * authenticated user's ID explicitly; service credentials never imply access
 * on behalf of a browser caller.
 */
export function getChatAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Chat persistence is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Returns a chat only when it belongs to the already verified user. */
export async function findOwnedChat(
  client: SupabaseClient,
  userId: string,
  chatId: string
): Promise<OwnedChat | null> {
  const { data, error } = await client
    .from("chats")
    .select("id, session_id, user_id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not verify chat ownership: ${error.message}`);
  return data as OwnedChat | null;
}

export function isSafeSessionId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 160;
}
