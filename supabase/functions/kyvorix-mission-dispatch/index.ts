// @ts-nocheck -- This file runs in Supabase's Deno Edge Runtime, not in the Next.js runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type DispatchSecrets = {
  cron_secret?: string | null;
  vercel_bypass_secret?: string | null;
  worker_url?: string | null;
};

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase dispatcher environment is incomplete.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const timestamp = request.headers.get("x-mission-timestamp") ?? "";
  const suppliedSignature = request.headers.get("x-mission-signature") ?? "";
  const numericTimestamp = /^\d{10}$/.test(timestamp) ? Number(timestamp) : 0;
  const timestampFresh = numericTimestamp > 0 &&
    Math.abs(Math.floor(Date.now() / 1000) - numericTimestamp) <= 120;

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!timestampFresh || JSON.stringify(body) !== "{}") {
    return Response.json({ error: "Invalid or expired dispatch request." }, { status: 401 });
  }

  const { data, error } = await admin.rpc("get_mission_dispatch_secrets");
  if (error || !data || typeof data !== "object") {
    console.error("[mission-dispatch:secrets]", error?.message ?? "Missing dispatcher configuration");
    return Response.json({ error: "Dispatcher configuration is unavailable." }, { status: 503 });
  }

  const secrets = data as DispatchSecrets;
  if (!secrets.cron_secret || !secrets.vercel_bypass_secret || !secrets.worker_url) {
    return Response.json({ error: "Dispatcher configuration is incomplete." }, { status: 503 });
  }

  const expectedSignature = await hmacHex(secrets.cron_secret, `${timestamp}.${JSON.stringify(body)}`);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) {
    return Response.json({ error: "Invalid dispatch signature." }, { status: 401 });
  }

  try {
    const workerResponse = await fetch(secrets.worker_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secrets.cron_secret}`,
        "x-vercel-protection-bypass": secrets.vercel_bypass_secret,
      },
      body: "{}",
      signal: AbortSignal.timeout(58_000),
      cache: "no-store",
    });
    const workerBody = await workerResponse.text();
    if (!workerResponse.ok) {
      console.error("[mission-dispatch:worker]", { status: workerResponse.status });
      return Response.json({ error: "Worker request failed.", status: workerResponse.status }, { status: 502 });
    }

    let outcome: unknown = { accepted: true };
    try { outcome = JSON.parse(workerBody); } catch { /* Keep the safe default. */ }
    return Response.json({ ok: true, outcome });
  } catch (error) {
    console.error("[mission-dispatch:fetch]", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Worker request timed out or could not be reached." }, { status: 502 });
  }
});
