-- Durable Mission Agent queue.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- All state is stored in Postgres so browser disconnects and function restarts do not lose progress.
create table if not exists public.mission_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text,
  title text not null check (char_length(title) between 1 and 120),
  prompt text not null check (char_length(prompt) between 1 and 12000),
  status text not null default 'queued'
    check (status in ('queued','running','retry_wait','completed','failed','cancelled')),
  plan jsonb not null default '[]'::jsonb check (jsonb_typeof(plan) = 'array'),
  current_step integer not null default 0 check (current_step >= 0),
  step_results jsonb not null default '[]'::jsonb check (jsonb_typeof(step_results) = 'array'),
  result text,
  verification jsonb not null default '{}'::jsonb check (jsonb_typeof(verification) = 'object'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  next_run_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  cancel_requested boolean not null default false,
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_heartbeat_at timestamptz
);

create unique index if not exists mission_jobs_user_idempotency_key_uq
  on public.mission_jobs(user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists mission_jobs_worker_pick_idx
  on public.mission_jobs(status, next_run_at, created_at)
  where status in ('queued','running','retry_wait');
create index if not exists mission_jobs_user_created_idx
  on public.mission_jobs(user_id, created_at desc);

alter table public.mission_jobs enable row level security;
drop policy if exists "mission_jobs_select_own" on public.mission_jobs;
create policy "mission_jobs_select_own"
  on public.mission_jobs for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.mission_jobs from anon;
revoke insert, update, delete on public.mission_jobs from authenticated;
grant select on public.mission_jobs to authenticated;
grant all on public.mission_jobs to service_role;

create or replace function public.claim_mission_job(p_lease_seconds integer default 90)
returns setof public.mission_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_lease_seconds < 20 or p_lease_seconds > 180 then
    raise exception 'Invalid mission lease duration';
  end if;

  -- Finish queued cancellations and recover jobs whose worker died while holding a lease.
  update public.mission_jobs
     set status = 'cancelled',
         lease_token = null,
         lease_expires_at = null,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where cancel_requested = true
     and status in ('queued','running','retry_wait')
     and (lease_expires_at is null or lease_expires_at < now());

  update public.mission_jobs
     set status = 'failed',
         last_error = coalesce(last_error, 'Worker lease expired repeatedly before a checkpoint was saved.'),
         lease_token = null,
         lease_expires_at = null,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where cancel_requested = false
     and status = 'running'
     and lease_expires_at < now()
     and attempt_count >= max_attempts;

  return query
  with candidate as (
    select id
      from public.mission_jobs
     where cancel_requested = false
       and status in ('queued','running','retry_wait')
       and next_run_at <= now()
       and (lease_expires_at is null or lease_expires_at < now())
       and attempt_count < max_attempts
     order by next_run_at asc, created_at asc
     for update skip locked
     limit 1
  )
  update public.mission_jobs as j
     set status = 'running',
         lease_token = gen_random_uuid(),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         attempt_count = j.attempt_count + 1,
         started_at = coalesce(j.started_at, now()),
         last_heartbeat_at = now(),
         updated_at = now()
    from candidate
   where j.id = candidate.id
  returning j.*;
end;
$$;

create or replace function public.record_mission_failure(
  p_job_id uuid,
  p_lease_token uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  update public.mission_jobs
     set status = case
           when cancel_requested then 'cancelled'
           when attempt_count >= max_attempts then 'failed'
           else 'retry_wait'
         end,
         next_run_at = case
           when cancel_requested or attempt_count >= max_attempts then next_run_at
           else now() + make_interval(secs => least(300, 15 * power(2, greatest(attempt_count - 1, 0))::integer))
         end,
         last_error = left(coalesce(p_error, 'Worker failed'), 2000),
         lease_token = null,
         lease_expires_at = null,
         completed_at = case when cancel_requested or attempt_count >= max_attempts then now() else completed_at end,
         updated_at = now()
   where id = p_job_id
     and lease_token = p_lease_token
     and status = 'running';
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.claim_mission_job(integer) from public, anon, authenticated;
revoke all on function public.record_mission_failure(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_mission_job(integer) to service_role;
grant execute on function public.record_mission_failure(uuid, uuid, text) to service_role;
