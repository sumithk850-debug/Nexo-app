"use client";

import { supabase } from "@/lib/supabase";

/** Adds the current Supabase session to same-origin requests that use a privileged route. */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}
