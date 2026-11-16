create table if not exists public.craft_v5_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint craft_v5_trial_window_check check (expires_at > started_at)
);

create index if not exists craft_v5_trials_expires_at_idx
  on public.craft_v5_trials (expires_at);

alter table public.craft_v5_trials enable row level security;

drop policy if exists "Users can read their Craft V5 trial" on public.craft_v5_trials;
create policy "Users can read their Craft V5 trial"
  on public.craft_v5_trials for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users cannot write Craft V5 trials from the client" on public.craft_v5_trials;
create policy "Users cannot write Craft V5 trials from the client"
  on public.craft_v5_trials for all to authenticated
  using (false) with check (false);

create or replace function public.set_craft_v5_trial_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists craft_v5_trials_updated_at on public.craft_v5_trials;
create trigger craft_v5_trials_updated_at before update on public.craft_v5_trials
for each row execute function public.set_craft_v5_trial_updated_at();

create table if not exists public.craft_v5_token_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  tokens_used integer not null default 0 check (tokens_used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.craft_v5_token_windows enable row level security;
drop policy if exists "Users can read their Craft V5 token window" on public.craft_v5_token_windows;
create policy "Users can read their Craft V5 token window"
  on public.craft_v5_token_windows for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users cannot write Craft V5 token windows from the client" on public.craft_v5_token_windows;
create policy "Users cannot write Craft V5 token windows from the client"
  on public.craft_v5_token_windows for all to authenticated
  using (false) with check (false);

create or replace function public.consume_craft_v5_tokens(
  p_user_id uuid,
  p_tokens integer,
  p_limit integer default 8000
)
returns table(allowed boolean, tokens_used integer, remaining_tokens integer, reset_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  current_row public.craft_v5_token_windows%rowtype;
  next_reset timestamptz;
begin
  if p_tokens <= 0 or p_tokens > p_limit then
    return query select false, 0, 0, now() + interval '12 hours';
    return;
  end if;

  select * into current_row from public.craft_v5_token_windows
  where user_id = p_user_id for update;

  if not found or current_row.window_started_at + interval '12 hours' <= now() then
    insert into public.craft_v5_token_windows(user_id, window_started_at, tokens_used, updated_at)
    values (p_user_id, now(), p_tokens, now())
    on conflict (user_id) do update set window_started_at = excluded.window_started_at,
      tokens_used = excluded.tokens_used, updated_at = now();
    next_reset := now() + interval '12 hours';
    return query select true, p_tokens, p_limit - p_tokens, next_reset;
    return;
  end if;

  next_reset := current_row.window_started_at + interval '12 hours';
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
