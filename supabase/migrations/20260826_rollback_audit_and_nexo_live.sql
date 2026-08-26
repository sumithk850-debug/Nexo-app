-- Restore the database posture that existed before the audit-remediation and
-- NEXO Live workstreams. This intentionally removes NEXO Live feature data.
-- Existing chat, message, and rate-limit rows are not deleted.

begin;

-- Remove the NEXO Live persistence model, functions, and concurrency indexes.
drop function if exists public.finish_live_talk_session(uuid, uuid);
drop function if exists public.get_live_talk_usage(uuid);
drop function if exists public.start_live_talk_session(uuid);
drop index if exists public.live_talk_one_active_session_per_user_idx;
drop index if exists public.live_talk_sessions_active_user_idx;
drop table if exists public.live_talk_sessions;
drop table if exists public.live_talk_daily_usage;
drop table if exists public.live_talk_preferences;

-- Restore the public RLS policy posture that preceded the audit remediation.
drop policy if exists "Users can manage their own chats" on public.chats;
drop policy if exists "anon all chats" on public.chats;
drop policy if exists "Allow all access to chats" on public.chats;
create policy "Allow all access to chats"
on public.chats
for all
to public
using (true)
with check (true);

drop policy if exists "Users can manage messages in their own chats" on public.messages;
drop policy if exists "anon all messages" on public.messages;
drop policy if exists "Allow all access to messages" on public.messages;
create policy "Allow all access to messages"
on public.messages
for all
to public
using (true)
with check (true);

drop policy if exists "anon all rate_limits" on public.rate_limits;
drop policy if exists "Allow all access to rate_limits" on public.rate_limits;
create policy "Allow all access to rate_limits"
on public.rate_limits
for all
to public
using (true)
with check (true);

commit;
