-- KYVORIX Artifact Studio security/performance follow-up
-- Keep auth.uid() as an init plan and index the artifact job foreign key.

drop policy if exists "Users can read their own artifacts" on public.artifacts;
drop policy if exists "Users can read their own artifact versions" on public.artifact_versions;
drop policy if exists "Users can read their own artifact jobs" on public.artifact_jobs;

create policy "Users can read their own artifacts"
  on public.artifacts for select using ((select auth.uid()) = user_id);

create policy "Users can read their own artifact versions"
  on public.artifact_versions for select using (
    exists (
      select 1
      from public.artifacts a
      where a.id = artifact_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "Users can read their own artifact jobs"
  on public.artifact_jobs for select using ((select auth.uid()) = user_id);

create index if not exists artifact_jobs_artifact_id_idx
  on public.artifact_jobs(artifact_id);
