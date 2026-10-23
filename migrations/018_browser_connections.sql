-- Migration 018: one-time local browser connection metadata
-- Only non-sensitive connection metadata is stored. Browser cookies, passwords,
-- page content, and extension secrets must never be persisted here.

CREATE TABLE IF NOT EXISTS browser_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_label TEXT NOT NULL DEFAULT 'Local browser',
  extension_id TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE browser_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS browser_connections_owner_select ON browser_connections;
CREATE POLICY browser_connections_owner_select ON browser_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS browser_connections_owner_write ON browser_connections;
CREATE POLICY browser_connections_owner_write ON browser_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
