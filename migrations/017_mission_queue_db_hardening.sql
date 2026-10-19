-- Pause dispatch while reinstalling pg_net into the dedicated extensions schema.
select cron.unschedule(jobid)
from cron.job
where jobname = 'kyvorix-mission-worker';

drop extension if exists pg_net;
drop schema if exists net;
create extension pg_net with schema extensions;

-- Avoid re-evaluating auth.uid() for every row in the owner policy.
drop policy if exists "mission_jobs_select_own" on public.mission_jobs;
create policy "mission_jobs_select_own"
  on public.mission_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
