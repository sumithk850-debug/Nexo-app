# KYVORIX Durable Mission Agent

## Runtime model

- The browser only creates a mission and reads its persisted status. It does not own the execution lifetime.
- Postgres stores the mission prompt, plan, step cursor, outputs, retry state, cancellation request, lease, and final verification record.
- The worker endpoint processes one bounded AI step per invocation. Provider calls have a 22-second timeout per model and try a small, fixed fallback list; the function itself has a 90-second maximum.
- The database claim function uses `FOR UPDATE SKIP LOCKED` and a short lease. Concurrent triggers cannot claim the same live lease. If a function is terminated, the expired lease makes the job eligible again.
- Successful steps are checkpointed before the worker exits. Transient failures use bounded exponential backoff; after three consecutive failures the job becomes `failed` and keeps its last safe error.
- Creation is authenticated and idempotency-key protected. Users can only list, read, or cancel their own jobs. The worker endpoint requires a server-only secret.
- The final verification is deliberately limited to generated-output completeness and plan structure. It does not claim that live browsing, repository tests, external writes, or deployments happened.

## Production scheduler

The worker is dispatched by Vercel Cron every minute from `vercel.json`. Vercel sends a GET request to `/api/internal/mission-worker`; the route verifies the bearer token against the server-only `CRON_SECRET` environment variable. Keep `CRON_SECRET` configured in the Vercel Production environment and never commit its value. No database scheduler extensions or secret-bearing HTTP calls from Postgres are required.

Vercel Cron invokes the function independently of a browser session. The cron call only claims one durable job and processes one bounded step. The Postgres lease prevents concurrent invocations from processing the same job, and saved checkpoints allow the next invocation to continue from the next step.

**Plan requirement:** the every-minute schedule requires a Vercel plan that supports per-minute cron execution (Pro or Enterprise). Vercel Hobby permits only daily cron schedules, so it cannot provide the intended background progress at this cadence. Verify the deployment's Cron Jobs panel after release.

## Operational checks

- Confirm the `kyvorix-mission-worker` cron job is enabled in `cron.job`.
- Inspect recent calls in `net._http_response` and queue state in `public.mission_jobs`; never log or expose the secret.
- Keep `CRON_SECRET` in Vercel's encrypted production environment only.
- Cancel is cooperative: an in-flight AI call may finish, but the result is discarded at the next checkpoint when cancellation has been requested.
- A job that exhausts retries remains visible with `last_error`; it is not silently marked complete.
