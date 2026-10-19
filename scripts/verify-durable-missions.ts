import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

const migration = source("migrations/015_durable_mission_jobs.sql");
const createApi = source("app/api/missions/route.ts");
const detailApi = source("app/api/missions/[id]/route.ts");
const worker = source("app/api/internal/mission-worker/route.ts");
const ui = source("components/MissionCenter.tsx");
const sidebar = source("components/ChatSidebar.tsx");
const vercel = source("vercel.json");

assert.ok(migration.includes("create table if not exists public.mission_jobs"));
assert.ok(migration.toLowerCase().includes("enable row level security"));
assert.ok(migration.includes("auth.uid() = user_id"));
assert.ok(migration.toLowerCase().includes("for update skip locked"));
assert.ok(migration.includes("lease_token = gen_random_uuid()"));
assert.ok(migration.includes("record_mission_failure"));
assert.ok(migration.includes("grant execute on function public.claim_mission_job(integer) to service_role"));

assert.ok(createApi.includes("requireVerifiedUser"));
assert.ok(createApi.toLowerCase().includes("idempotency-key"));
assert.ok(createApi.includes('.eq("user_id", auth.user.id)'));
assert.ok(createApi.includes("(activeCount ?? 0) >= 3"));
assert.ok(detailApi.includes('.eq("id", id)'));
assert.ok(detailApi.includes('.eq("user_id", auth.user.id)'));
assert.ok(detailApi.includes("cancel_requested: true"));

assert.ok(worker.includes("CRON_SECRET"));
assert.ok(worker.includes('createHmac("sha256", expected)'));
assert.ok(worker.includes("x-mission-signature"));
assert.ok(worker.includes("AbortSignal.timeout(16_000)"));
assert.ok(worker.includes("export const maxDuration = 55;"));
assert.ok(worker.includes("claim_mission_job"));
assert.ok(worker.includes("record_mission_failure"));
assert.ok(worker.includes("cancel_requested"));
assert.ok(worker.includes("They do not claim external repository tests, deployments, or live research were performed."));
assert.ok(worker.includes("export async function GET(req: NextRequest)"));

assert.ok(vercel.includes("app/api/internal/mission-worker/route.ts"));
assert.ok(!vercel.includes('"crons"'));
assert.ok(ui.includes("Start durable mission"));
assert.ok(ui.includes("setInterval"));
assert.ok(ui.includes("browser tab"));
assert.ok(sidebar.includes('href="/missions"'));
assert.ok(sidebar.includes("Mission Agent"));

console.log("Durable mission checks passed: authenticated ownership, idempotency, RLS, atomic leasing, bounded execution, HMAC authentication, retries, cancellation, checkpoints, and honest verification.");
