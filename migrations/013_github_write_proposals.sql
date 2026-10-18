-- Server-enforced, short-lived GitHub write proposals.
-- A proposal snapshots the exact approved files and repository head before any
-- mutation. The commit route consumes it once and never trusts browser files.
CREATE TABLE IF NOT EXISTS public.github_write_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  repo_full_name text NOT NULL,
  base_commit_sha text NOT NULL,
  base_tree_sha text NOT NULL,
  default_branch text NOT NULL,
  commit_message text NOT NULL,
  files jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS github_write_proposals_user_idx
  ON public.github_write_proposals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS github_write_proposals_expiry_idx
  ON public.github_write_proposals (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.github_write_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own GitHub write proposals"
  ON public.github_write_proposals;
CREATE POLICY "Users can view own GitHub write proposals"
  ON public.github_write_proposals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/consumption are performed only by the server service role. No client
-- policy is granted for creating or mutating proposals.
