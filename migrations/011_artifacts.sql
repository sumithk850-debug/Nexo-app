-- KYVORIX Artifact Studio foundation
-- Apply only after reviewing against the connected Supabase project.
-- This migration is additive and does not alter existing chat or integration tables.

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid null,
  type text not null check (type in ('excel', 'csv', 'presentation', 'pdf')),
  title text not null,
  status text not null default 'ready' check (status in ('planning', 'generating', 'validating', 'ready', 'failed', 'expired')),
  storage_path text,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version integer not null check (version > 0),
  schema_json jsonb not null,
  storage_path text,
  change_summary text,
  created_at timestamptz not null default now(),
  unique (artifact_id, version)
);

create table if not exists public.artifact_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete set null,
  job_type text not null check (job_type in ('plan', 'generate', 'validate', 'export', 'edit')),
  status text not null default 'planning' check (status in ('planning', 'generating', 'validating', 'ready', 'failed', 'expired')),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.artifacts enable row level security;
alter table public.artifact_versions enable row level security;
alter table public.artifact_jobs enable row level security;

create policy "Users can read their own artifacts"
  on public.artifacts for select using (auth.uid() = user_id);
create policy "Users can read their own artifact versions"
  on public.artifact_versions for select using (
    exists (select 1 from public.artifacts a where a.id = artifact_id and a.user_id = auth.uid())
  );
create policy "Users can read their own artifact jobs"
  on public.artifact_jobs for select using (auth.uid() = user_id);

create index if not exists artifacts_user_updated_idx on public.artifacts(user_id, updated_at desc);
create index if not exists artifact_jobs_user_created_idx on public.artifact_jobs(user_id, created_at desc);
