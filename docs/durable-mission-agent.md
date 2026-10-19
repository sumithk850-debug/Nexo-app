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

Supabase Cron (`pg_cron`) triggers a small Supabase Edge Function every minute. That dispatcher validates a timestamped HMAC, retrieves server-side secrets through a service-role-only database function, then calls the Vercel worker with Vercel's deployment-protection bypass header. This keeps the raw bypass token out of `pg_net` request rows and avoids disabling Vercel Authentication.

The Vercel worker function is capped at 55 seconds and each model attempt times out after 16 seconds. Supabase Cron dispatches the worker independently of an open browser; Postgres leases and checkpoints remain the source of truth.

The Vercel Production environment contains a sensitive `CRON_SECRET`. The same secret and the Vercel automation-bypass secret are stored in Supabase Vault; neither value belongs in source control or cron headers. The scheduled request carries only a timestamp and an HMAC-SHA256 signature, which expires after two minutes.

After applying migrations `015`–`017` and deploying the Edge Function, ensure these Vault entries exist:
- `kyvorix_mission_worker_secret`: same value as Vercel's `CRON_SECRET`
- `kyvorix_vercel_bypass_secret`: Vercel Protection Bypass for Automation secret
- `kyvorix_mission_worker_url`: `https://nexo-app-hasith-s-projects3.vercel.app/api/internal/mission-worker`
- `kyvorix_mission_dispatch_url`: `https://apvqebqigqirmvemhnmz.supabase.co/functions/v1/kyvorix-mission-dispatch`

The two secret values are provisioned out-of-band in the encrypted secret stores; do not print them or commit them.

Schedule the dispatcher once:

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
      where name = 'kyvorix_mission_dispatch_url'
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
      timeout_milliseconds := 65000
    )
    from clock, secret, target;
  $job$
);
```

The cron invocation only dispatches one bounded step; it does not hold a four-minute request open. If the cron job already exists, scheduling with the same name updates it. Do not create duplicate jobs with different names.

## Operational checks

- Confirm the `kyvorix-mission-worker` cron job is enabled in `cron.job`.
- Inspect recent calls in `net._http_response`, Supabase Edge Function logs, and queue state in `public.mission_jobs`; never log or expose either secret.
- Keep `CRON_SECRET` and the Vercel bypass secret in encrypted secret stores only; never log or expose their raw values.
- Cancel is cooperative: an in-flight AI call may finish, but the result is discarded at the next checkpoint when cancellation has been requested.
- A job that exhausts retries remains visible with `last_error`; it is not silently marked complete.
