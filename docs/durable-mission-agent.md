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

The active scheduler is Supabase `pg_cron` calling the Vercel worker through `pg_net`. This keeps execution independent of an open browser and avoids depending on Vercel Cron plan frequency.

After deploying the worker and setting the Vercel production environment variable `MISSION_WORKER_SECRET`, store the same secret in Supabase Vault under `kyvorix_mission_worker_secret`, and store the worker URL under `kyvorix_mission_worker_url`. Never commit either value. Then schedule the following query once, replacing only the secret values in the Vault setup—not in this file:

```sql
select cron.schedule(
  'kyvorix-mission-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'kyvorix_mission_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'kyvorix_mission_worker_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $job$
);
```

The worker URL is the production alias plus `/api/internal/mission-worker`. A scheduler request only dispatches one bounded step; it does not hold a four-minute request open. The queue remains the source of truth if the scheduler or worker temporarily fails.

## Operational checks

- Confirm the `kyvorix-mission-worker` cron job is enabled in `cron.job`.
- Inspect recent calls in `net._http_response` and queue state in `public.mission_jobs`; never log or expose the secret.
- Keep the worker secret in Vercel's encrypted production environment and Supabase Vault only.
- Cancel is cooperative: an in-flight AI call may finish, but the result is discarded at the next checkpoint when cancellation has been requested.
- A job that exhausts retries remains visible with `last_error`; it is not silently marked complete.
