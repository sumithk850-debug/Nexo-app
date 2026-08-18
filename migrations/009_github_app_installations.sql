-- Stores the GitHub App installation selected by each Nexo user.
-- The server exchanges its signed App JWT for a short-lived installation token at runtime;
-- installation tokens are deliberately never stored in the database.
ALTER TABLE public.github_connections
  ADD COLUMN IF NOT EXISTS installation_id text;

CREATE INDEX IF NOT EXISTS github_connections_installation_id_idx
  ON public.github_connections (installation_id)
  WHERE installation_id IS NOT NULL;
