ALTER TABLE public.github_write_proposals
  ADD COLUMN IF NOT EXISTS target_mode text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS target_branch text;

ALTER TABLE public.github_write_proposals
  DROP CONSTRAINT IF EXISTS github_write_proposals_target_mode_check;
ALTER TABLE public.github_write_proposals
  ADD CONSTRAINT github_write_proposals_target_mode_check
  CHECK (target_mode IN ('direct', 'pr'));
