-- Add refresh_token column to supabase_connections so Supabase OAuth
-- access tokens can be refreshed when they expire.
-- https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
ALTER TABLE supabase_connections
  ADD COLUMN IF NOT EXISTS refresh_token text;
