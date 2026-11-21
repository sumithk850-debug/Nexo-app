-- Craft V5 is a free daily allowance: 1,000 tokens per user per 24-hour window.
-- The server passes the current limit explicitly; this function remains service-role only.
create or replace function public.consume_craft_v5_tokens(
  p_user_id uuid,
  p_tokens integer,
  p_limit integer default 1000
)
returns table(allowed boolean, tokens_used integer, remaining_tokens integer, reset_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  current_row public.craft_v5_token_windows%rowtype;
  next_reset timestamptz;
begin
  if p_tokens <= 0 or p_tokens > p_limit then
    return query select false, 0, 0, now() + interval '24 hours';
    return;
  end if;

  select * into current_row from public.craft_v5_token_windows
    where user_id = p_user_id for update;

  if not found or current_row.window_started_at + interval '24 hours' <= now() then
    insert into public.craft_v5_token_windows(user_id, window_started_at, tokens_used, updated_at)
      values (p_user_id, now(), p_tokens, now())
      on conflict (user_id) do update set window_started_at = excluded.window_started_at,
        tokens_used = excluded.tokens_used, updated_at = now();
    return query select true, p_tokens, p_limit - p_tokens, now() + interval '24 hours';
    return;
  end if;

  next_reset := current_row.window_started_at + interval '24 hours';
  if current_row.tokens_used + p_tokens > p_limit then
    return query select false, current_row.tokens_used, 0, next_reset;
    return;
  end if;

  update public.craft_v5_token_windows
    set tokens_used = current_row.tokens_used + p_tokens, updated_at = now()
    where user_id = p_user_id;
  return query select true, current_row.tokens_used + p_tokens,
    p_limit - current_row.tokens_used - p_tokens, next_reset;
end;
$$;

grant execute on function public.consume_craft_v5_tokens(uuid, integer, integer) to service_role;
revoke execute on function public.consume_craft_v5_tokens(uuid, integer, integer) from anon, authenticated;
