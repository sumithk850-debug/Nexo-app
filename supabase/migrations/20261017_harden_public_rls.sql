-- Harden direct Data API access to private chat and usage records.
-- The application uses a server-only service-role client for these operations and
-- checks the high-entropy browser UUID against each chat before reading or writing.
-- No existing user data is deleted or rewritten by this migration.

alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.rate_limits enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "Allow all access to chats" on public.chats;
drop policy if exists "Allow all access to messages" on public.messages;
drop policy if exists "Allow all access to rate_limits" on public.rate_limits;

drop policy if exists "Allow all access to announcements" on public.announcements;
drop policy if exists "Allow read access to announcements" on public.announcements;
drop policy if exists "anon read announcements" on public.announcements;
drop policy if exists "Public can read announcements" on public.announcements;

revoke all privileges on table public.chats from public, anon, authenticated;
revoke all privileges on table public.messages from public, anon, authenticated;
revoke all privileges on table public.rate_limits from public, anon, authenticated;
revoke all privileges on table public.announcements from public, anon, authenticated;

grant select on table public.announcements to anon, authenticated;
create policy "Public can read announcements"
  on public.announcements for select to anon, authenticated using (true);

grant select, insert, update, delete on table public.chats to service_role;
grant select, insert, update, delete on table public.messages to service_role;
grant select, insert, update, delete on table public.rate_limits to service_role;
grant select on table public.announcements to service_role;
