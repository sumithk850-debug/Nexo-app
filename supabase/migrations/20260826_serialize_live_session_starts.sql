-- Serialize session starts per user to keep the daily NEXO Live allowance exact
-- when multiple tabs or devices request a session at the same time.
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

revoke all on function public.start_live_talk_session(uuid) from public, anon, authenticated;
grant execute on function public.start_live_talk_session(uuid) to service_role;
