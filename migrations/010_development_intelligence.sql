-- Nexo Development Intelligence: user-owned workspace data only.
-- No OAuth credentials, repository source, database records, deployment tokens,
-- or tool output are stored in these tables.

CREATE TABLE IF NOT EXISTS public.project_brains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  conventions text NOT NULL DEFAULT '' CHECK (char_length(conventions) <= 4000),
  goals text NOT NULL DEFAULT '' CHECK (char_length(goals) <= 4000),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_brains_one_active_per_user_idx
  ON public.project_brains (user_id)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS project_brains_user_updated_idx
  ON public.project_brains (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.brain_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_brain_id uuid REFERENCES public.project_brains(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  detail text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 4000),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'blocked', 'completed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brain_tasks_user_status_idx
  ON public.brain_tasks (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS brain_tasks_project_idx
  ON public.brain_tasks (project_brain_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.response_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  instruction text NOT NULL DEFAULT '' CHECK (char_length(instruction) <= 2000),
  detail_level text NOT NULL DEFAULT 'balanced' CHECK (detail_level IN ('concise', 'balanced', 'detailed')),
  preferred_language text NOT NULL DEFAULT 'auto' CHECK (preferred_language IN ('auto', 'english', 'sinhala')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 12000),
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_entries_user_updated_idx
  ON public.knowledge_entries (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.regression_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  overall_status text NOT NULL CHECK (overall_status IN ('ready', 'attention', 'blocked')),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 5000),
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS regression_reports_user_created_idx
  ON public.regression_reports (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.release_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  version text NOT NULL DEFAULT '' CHECK (char_length(version) <= 80),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 6000),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS release_briefs_user_updated_idx
  ON public.release_briefs (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  recipe_type text NOT NULL CHECK (recipe_type IN ('review_repository', 'audit_schema', 'prepare_release', 'check_deployment')),
  enabled boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT true CHECK (approval_required),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_recipes_user_updated_idx
  ON public.automation_recipes (user_id, updated_at DESC);

ALTER TABLE public.project_brains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regression_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_brains_owned_by_user" ON public.project_brains
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brain_tasks_owned_by_user" ON public.brain_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "response_preferences_owned_by_user" ON public.response_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "knowledge_entries_owned_by_user" ON public.knowledge_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "regression_reports_owned_by_user" ON public.regression_reports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "release_briefs_owned_by_user" ON public.release_briefs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "automation_recipes_owned_by_user" ON public.automation_recipes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_development_intelligence_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_brains_touch_updated_at ON public.project_brains;
CREATE TRIGGER project_brains_touch_updated_at
BEFORE UPDATE ON public.project_brains
FOR EACH ROW EXECUTE FUNCTION public.touch_development_intelligence_updated_at();

DROP TRIGGER IF EXISTS brain_tasks_touch_updated_at ON public.brain_tasks;
CREATE TRIGGER brain_tasks_touch_updated_at
BEFORE UPDATE ON public.brain_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_development_intelligence_updated_at();

DROP TRIGGER IF EXISTS response_preferences_touch_updated_at ON public.response_preferences;
CREATE TRIGGER response_preferences_touch_updated_at
BEFORE UPDATE ON public.response_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_development_intelligence_updated_at();

DROP TRIGGER IF EXISTS knowledge_entries_touch_updated_at ON public.knowledge_entries;
CREATE TRIGGER knowledge_entries_touch_updated_at
BEFORE UPDATE ON public.knowledge_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_development_intelligence_updated_at();

DROP TRIGGER IF EXISTS release_briefs_touch_updated_at ON public.release_briefs;
CREATE TRIGGER release_briefs_touch_updated_at
BEFORE UPDATE ON public.release_briefs
FOR EACH ROW EXECUTE FUNCTION public.touch_development_intelligence_updated_at();

DROP TRIGGER IF EXISTS automation_recipes_touch_updated_at ON public.automation_recipes;
CREATE TRIGGER automation_recipes_touch_updated_at
BEFORE UPDATE ON public.automation_recipes
FOR EACH ROW EXECUTE FUNCTION public.touch_development_intelligence_updated_at();
