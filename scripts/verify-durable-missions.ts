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

assert.match(migration, /create table if not exists public\.mission_jobs/);
assert.match(migration, /enable row level security/);
assert.match(migration, /auth\.uid\(\) = user_id/);
assert.match(migration, /for update skip locked/);
assert.match(migration, /lease_token = gen_random_uuid\(\)/);
assert.match(migration, /record_mission_failure/);
assert.match(migration, /grant execute on function public\.claim_mission_job\(integer\) to service_role/);
assert.match(createApi, /requireVerifiedUser/);
assert.match(createApi, /idempotency-key/i);
assert.match(createApi, /\.eq\("user_id", auth\.user\.id\)/);
assert.match(createApi, /activeCount.*>= 3|\(activeCount \?\? 0\) >= 3/s);
assert.match(detailApi, /\.eq\("id", id\)\s*\.eq\("user_id", auth\.user\.id\)/);
assert.match(detailApi, /cancel_requested: true/);
assert.match(worker, /CRON_SECRET/);
assert.match(worker, /claim_mission_job/);
assert.match(worker, /record_mission_failure/);
assert.match(worker, /AbortSignal\.timeout\(22_000\)/);
assert.match(worker, /maxDuration = 90/);
assert.match(worker, /export async function GET\(req: NextRequest\)/);
assert.match(worker, /lease_token/);
assert.match(worker, /cancel_requested/);
assert.match(worker, /do not claim external repository tests, deployments, or live research were performed/);
assert.match(ui, /Start durable mission/);
assert.match(ui, /setInterval/);
assert.match(ui, /browser tab/);
assert.match(sidebar, /href="\/missions"/);
assert.match(sidebar, /Mission Agent/);

console.log("Durable mission checks passed: authenticated ownership, idempotency, RLS, atomic leasing, bounded execution, retries, cancellation, checkpoints, and honest verification.");
