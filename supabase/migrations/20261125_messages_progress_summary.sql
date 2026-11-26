-- Stores the chat "Summary" timeline (the steps shown under an assistant reply)
-- so it is still visible after the chat is reloaded.
--
-- Safe to run more than once. The app keeps working if this has not been run
-- yet: replies are saved without their Summary and old replies simply show none.

alter table public.messages
  add column if not exists progress jsonb;

comment on column public.messages.progress is
  'Summary timeline for an assistant reply: {"lang":"si|en","steps":[...]}. Written by /api/chats/[id]/messages, never by a model.';

-- Keep each stored Summary small (the app itself caps it well below this).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_progress_size_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_progress_size_check
      check (progress is null or pg_column_size(progress) <= 16384);
  end if;
end
$$;
