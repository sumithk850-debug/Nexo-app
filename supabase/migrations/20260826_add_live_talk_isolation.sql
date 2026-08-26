-- Nexo Live Talk: user-scoped preferences and cumulative daily usage.
-- No raw audio, transcript, or provider credential is persisted here.

create table if not exists public.live_talk_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'auto' check (language in ('auto', 'si', 'en')),
  speed text not null default 'normal' check (speed in ('slow', 'normal', 'fast')),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_talk_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used_seconds integer not null default 0 check (used_seconds >= 0 and used_seconds <= 1200),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.live_talk_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  billed_seconds integer not null default 0 check (billed_seconds >= 0 and billed_seconds <= 1200),
  status text not null default 'active' check (status in ('active', 'ended', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists live_talk_sessions_active_user_idx
  on public.live_talk_sessions (user_id, status, expires_at desc);

alter table public.live_talk_preferences enable row level security;
alter table public.live_talk_daily_usage enable row level security;
alter table public.live_talk_sessions enable row level security;

-- These records are intentionally server-only. The verified Next.js routes use
-- the service role after independently authenticating the bearer token.
drop policy if exists "live talk preferences owner only" on public.live_talk_preferences;
drop policy if exists "live talk usage owner only" on public.live_talk_daily_usage;
drop policy if exists "live talk sessions owner only" on public.live_talk_sessions;
revoke all on table public.live_talk_preferences from public, anon, authenticated;
revoke all on table public.live_talk_daily_usage from public, anon, authenticated;
revoke all on table public.live_talk_sessions from public, anon, authenticated;
grant all on table public.live_talk_preferences to service_role;
grant all on table public.live_talk_daily_usage to service_role;
grant all on table public.live_talk_sessions to service_role;

create or replace function public.finish_live_talk_session(
  p_user_id uuid,
  p_session_id uuid
)
returns table (
  used_seconds integer,
  remaining_seconds integer,
  active_session_id uuid,
  active_expires_at timestamptz,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.live_talk_sessions%rowtype;
  v_billed_seconds integer := 0;
  v_used_seconds integer := 0;
  v_usage_date date := timezone('Asia/Colombo', now())::date;
begin
  select * into v_session
  from public.live_talk_sessions
  where id = p_session_id and user_id = p_user_id and status = 'active'
  for update;

  if found then
    v_billed_seconds := greatest(
      0,
      least(
        1200,
        floor(extract(epoch from least(now(), v_session.expires_at) - v_session.started_at))::integer
      )
    );

    update public.live_talk_sessions
    set status = case when now() >= v_session.expires_at then 'expired' else 'ended' end,
        ended_at = now(),
        billed_seconds = v_billed_seconds
    where id = v_session.id;

    insert into public.live_talk_daily_usage (user_id, usage_date, used_seconds, updated_at)
    values (p_user_id, v_session.usage_date, v_billed_seconds, now())
    on conflict (user_id, usage_date) do update
    set used_seconds = least(1200, public.live_talk_daily_usage.used_seconds + excluded.used_seconds),
        updated_at = now()
    returning public.live_talk_daily_usage.used_seconds into v_used_seconds;
  else
    select coalesce(used_seconds, 0) into v_used_seconds
    from public.live_talk_daily_usage
    where user_id = p_user_id and usage_date = v_usage_date;
    v_used_seconds := coalesce(v_used_seconds, 0);
  end if;

  return query
  select
    least(1200, v_used_seconds),
    greatest(0, 1200 - least(1200, v_used_seconds)),
    null::uuid,
    null::timestamptz,
    ((timezone('Asia/Colombo', now())::date + 1)::timestamp at time zone 'Asia/Colombo');
end;
$$;

create or replace function public.get_live_talk_usage(p_user_id uuid)
returns table (
  used_seconds integer,
  remaining_seconds integer,
  active_session_id uuid,
  active_expires_at timestamptz,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.live_talk_sessions%rowtype;
  v_used_seconds integer := 0;
  v_usage_date date := timezone('Asia/Colombo', now())::date;
begin
  select * into v_active
  from public.live_talk_sessions
  where user_id = p_user_id and status = 'active'
  order by started_at desc
  limit 1;

  if found and v_active.expires_at <= now() then
    perform public.finish_live_talk_session(p_user_id, v_active.id);
    v_active := null;
  end if;

  select coalesce(used_seconds, 0) into v_used_seconds
  from public.live_talk_daily_usage
  where user_id = p_user_id and usage_date = v_usage_date;
  v_used_seconds := coalesce(v_used_seconds, 0);

  return query
  select
    least(1200, v_used_seconds),
    greatest(0, 1200 - least(1200, v_used_seconds)),
    case when v_active.id is null then null else v_active.id end,
    case when v_active.id is null then null else v_active.expires_at end,
    ((timezone('Asia/Colombo', now())::date + 1)::timestamp at time zone 'Asia/Colombo');
end;
$$;

create or replace function public.start_live_talk_session(p_user_id uuid)
returns table (
  session_id uuid,
  remaining_seconds integer,
  expires_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.live_talk_sessions%rowtype;
  v_used_seconds integer := 0;
  v_remaining_seconds integer := 0;
  v_usage_date date := timezone('Asia/Colombo', now())::date;
  v_new_session public.live_talk_sessions%rowtype;
begin
  -- Serialize starts per account so concurrent browser tabs cannot create
  -- overlapping live sessions before the active-session index is observed.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into v_active
  from public.live_talk_sessions
  where user_id = p_user_id and status = 'active'
  order by started_at desc
  limit 1
  for update;

  if found and v_active.expires_at > now() then
    return query select v_active.id, greatest(0, floor(extract(epoch from v_active.expires_at - now()))::integer), v_active.expires_at, 'active'::text;
    return;
  elsif found then
    perform public.finish_live_talk_session(p_user_id, v_active.id);
  end if;

  select coalesce(used_seconds, 0) into v_used_seconds
  from public.live_talk_daily_usage
  where user_id = p_user_id and usage_date = v_usage_date;
  v_used_seconds := coalesce(v_used_seconds, 0);
  v_remaining_seconds := greatest(0, 1200 - least(1200, v_used_seconds));

  if v_remaining_seconds = 0 then
    return query select null::uuid, 0, null::timestamptz, 'limit'::text;
    return;
  end if;

  insert into public.live_talk_sessions (user_id, usage_date, expires_at)
  values (p_user_id, v_usage_date, now() + make_interval(secs => v_remaining_seconds))
  returning * into v_new_session;

  return query select v_new_session.id, v_remaining_seconds, v_new_session.expires_at, 'started'::text;
end;
$$;

revoke all on function public.finish_live_talk_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_live_talk_usage(uuid) from public, anon, authenticated;
revoke all on function public.start_live_talk_session(uuid) from public, anon, authenticated;
grant execute on function public.finish_live_talk_session(uuid, uuid) to service_role;
grant execute on function public.get_live_talk_usage(uuid) to service_role;
grant execute on function public.start_live_talk_session(uuid) to service_role;
