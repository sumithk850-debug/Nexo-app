-- Prevent more than one active NEXO Live session for the same user.
-- Completed/expired sessions remain available for server-side accounting only.
create unique index if not exists live_talk_one_active_session_per_user_idx
  on public.live_talk_sessions (user_id)
  where status = 'active';
