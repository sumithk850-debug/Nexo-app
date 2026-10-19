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

The active scheduler is Supabase Cron (`pg_cron`) calling the Vercel worker through `pg_net` every minute. This works independently of Vercel Cron plan frequency. The Vercel worker function is capped at 55 seconds and each model attempt times out after 16 seconds, leaving time for fallback and checkpoint writes.

The Vercel Production environment contains a sensitive `CRON_SECRET`. Store the same secret in Supabase Vault as `kyvorix_mission_worker_secret`, and store the production worker URL as `kyvorix_mission_worker_url`. Do not put the secret directly into the cron command or request headers. The scheduled request sends only a timestamp and an HMAC-SHA256 signature; the worker rejects signatures older than two minutes.

After the database migration is applied and the Vercel production deployment is ready, create the Vault entries (replace the placeholders locally in the Supabase SQL editor; never commit the real value):

```sql
select vault.create_secret('REPLACE_WITH_CRON_SECRET', 'kyvorix_mission_worker_secret');
select vault.create_secret('https://nexo-app-hasith-s-projects3.vercel.app/api/internal/mission-worker', 'kyvorix_mission_worker_url');
```

Then schedule the worker once:

```sql
select cron.schedule(
  'kyvorix-mission-worker',
  '* * * * *',
  $job$
    with clock as (
      select floor(extract(epoch from clock_timestamp()))::bigint::text as ts
    ),
    secret as (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'kyvorix_mission_worker_secret'
    ),
    target as (
      select decrypted_secret as url
      from vault.decrypted_secrets
      where name = 'kyvorix_mission_worker_url'
    )
    select net.http_post(
      url := target.url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-mission-timestamp', clock.ts,
        'x-mission-signature', encode(
          extensions.hmac(clock.ts || '.{}', secret.decrypted_secret, 'sha256'),
          'hex'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    )
    from clock, secret, target;
  $job$
);
```

The cron invocation only dispatches one bounded step; it does not hold a four-minute request open. The queue remains the source of truth if a scheduler run or worker invocation fails. If the cron job already exists, `cron.schedule` with the same name updates it; do not create duplicate jobs with different names.

## Operational checks

- Confirm the `kyvorix-mission-worker` cron job is enabled in `cron.job`.
- Inspect recent calls in `net._http_response` and queue state in `public.mission_jobs`; never log or expose the secret.
- Keep `CRON_SECRET` in Vercel's encrypted production environment and Supabase Vault only; never log or expose the raw value.
- Cancel is cooperative: an in-flight AI call may finish, but the result is discarded at the next checkpoint when cancellation has been requested.
- A job that exhausts retries remains visible with `last_error`; it is not silently marked complete.
