-- Secure chat history and messages without assigning unowned legacy rows.
-- Existing rows with user_id IS NULL intentionally remain inaccessible: there is no
-- trustworthy ownership evidence for them, and they must never be claimable.

begin;

alter table public.chats enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Allow all access to chats" on public.chats;
drop policy if exists "anon all chats" on public.chats;
drop policy if exists "Users can manage their own chats" on public.chats;

drop policy if exists "Allow all access to messages" on public.messages;
drop policy if exists "anon all messages" on public.messages;
drop policy if exists "Users can manage messages in their own chats" on public.messages;

create policy "Users can manage their own chats"
on public.chats
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage messages in their own chats"
on public.messages
for all
to authenticated
using (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
  )
);

commit;
