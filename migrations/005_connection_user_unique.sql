-- Migration 005: unique index on user_id for integration connection tables
-- The Vercel/Supabase OAuth callbacks upsert a row keyed by user_id. Without a
-- unique index the upsert's onConflict target has no matching constraint and
-- the save silently fails, leaving cards stuck on "Not connected".

CREATE UNIQUE INDEX IF NOT EXISTS vercel_connections_user_id_key ON vercel_connections (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS supabase_connections_user_id_key ON supabase_connections (user_id);
