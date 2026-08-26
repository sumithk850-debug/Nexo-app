-- NEXO Live usage is isolated from the existing model token ledger.
-- No raw audio, transcript, API key, or provider response is persisted.

create table if not exists public.nexo_voice_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  used_seconds integer not null default 0 check (used_seconds >= 0 and used_seconds <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.nexo_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  max_duration_seconds integer not null check (max_duration_seconds between 1 and 60),
  duration_seconds integer not null default 0 check (duration_seconds >= 0 and duration_seconds <= 60),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists nexo_voice_one_active_session_per_user
  on public.nexo_voice_sessions (user_id)
  where ended_at is null;

create index if not exists nexo_voice_sessions_user_date_idx
  on public.nexo_voice_sessions (user_id, usage_date);

alter table public.nexo_voice_daily_usage enable row level security;
alter table public.nexo_voice_sessions enable row level security;

revoke all on table public.nexo_voice_daily_usage from anon, authenticated;
revoke all on table public.nexo_voice_sessions from anon, authenticated;

create or replace function public.start_nexo_voice_session(
  p_user_id uuid,
  p_daily_limit_seconds integer default 1200,
  p_max_turn_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_usage integer := 0;
  remaining integer := 0;
  session_id uuid;
  turn_limit integer := least(greatest(coalesce(p_max_turn_seconds, 60), 1), 60);
  daily_limit integer := least(greatest(coalesce(p_daily_limit_seconds, 1200), 1), 1200);
  today date := (timezone('utc', now()))::date;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 271826));

  -- Recover sessions orphaned by a closed tab, lost network, or browser crash.
  -- A real turn is capped at 60 seconds, so five minutes is conservative.
  update public.nexo_voice_sessions
  set ended_at = now(), status = 'cancelled', duration_seconds = 0
  where id in (
    select id
    from public.nexo_voice_sessions
    where user_id = p_user_id
      and ended_at is null
      and started_at < now() - interval '5 minutes'
    order by started_at asc
    limit 50
  );

  if exists (
    select 1 from public.nexo_voice_sessions
    where user_id = p_user_id and ended_at is null
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'A voice session is already active.');
  end if;

  select used_seconds into current_usage
  from public.nexo_voice_daily_usage
  where user_id = p_user_id and usage_date = today
  for update;

  current_usage := greatest(coalesce(current_usage, 0), 0);
  remaining := greatest(daily_limit - current_usage, 0);
  if remaining <= 0 then
    return jsonb_build_object('allowed', false, 'reason', 'Your daily voice allowance has been used.');
  end if;

  turn_limit := least(turn_limit, remaining);
  insert into public.nexo_voice_sessions (user_id, usage_date, max_duration_seconds)
  values (p_user_id, today, turn_limit)
  returning id into session_id;

  return jsonb_build_object(
    'allowed', true,
    'sessionId', session_id,
    'remainingSeconds', remaining,
    'maxDurationSeconds', turn_limit
  );
exception
  when unique_violation then
    return jsonb_build_object('allowed', false, 'reason', 'A voice session is already active.');
end;
$$;

create or replace function public.finish_nexo_voice_session(
  p_user_id uuid,
  p_session_id uuid,
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  voice_session public.nexo_voice_sessions%rowtype;
  duration integer := 0;
  used integer := 0;
  today date := (timezone('utc', now()))::date;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 271826));

  select * into voice_session
  from public.nexo_voice_sessions
  where id = p_session_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Voice session not found';
  end if;

  if voice_session.ended_at is null then
    if p_status = 'cancelled' then
      duration := 0;
    else
      duration := least(
        greatest(floor(extract(epoch from (now() - voice_session.started_at)))::integer, 0),
        voice_session.max_duration_seconds
      );
    end if;
    update public.nexo_voice_sessions
    set ended_at = now(), duration_seconds = duration,
        status = case when p_status = 'cancelled' then 'cancelled' else 'completed' end
    where id = p_session_id;

    if duration > 0 and p_status <> 'cancelled' then
      insert into public.nexo_voice_daily_usage (user_id, usage_date, used_seconds)
      values (p_user_id, today, least(duration, 1200))
      on conflict (user_id, usage_date) do update
      set used_seconds = least(1200, public.nexo_voice_daily_usage.used_seconds + excluded.used_seconds),
          updated_at = now();
    end if;
  else
    duration := voice_session.duration_seconds;
  end if;

  select used_seconds into used
  from public.nexo_voice_daily_usage
  where user_id = p_user_id and usage_date = today;

  return jsonb_build_object(
    'durationSeconds', duration,
    'usedSeconds', greatest(coalesce(used, 0), 0),
    'remainingSeconds', greatest(1200 - greatest(coalesce(used, 0), 0), 0)
  );
end;
$$;

revoke all on function public.start_nexo_voice_session(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.finish_nexo_voice_session(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_nexo_voice_session(uuid, integer, integer) to service_role;
grant execute on function public.finish_nexo_voice_session(uuid, uuid, text) to service_role;
