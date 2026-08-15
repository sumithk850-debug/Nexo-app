-- Per-user Vercel and Supabase connections (Nexo Integrations)
-- Mirrors the github_connections pattern: user_id unique, encrypted tokens,
-- owner-only RLS policies. Service role (the Next.js API routes) always uses
-- the service-role key, so these policies primarily protect client-side access.

CREATE TABLE IF NOT EXISTS public.vercel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vercel_username text,
  access_token text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vercel_connections_user_id_key ON public.vercel_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_vercel_connections_user ON public.vercel_connections (user_id);

ALTER TABLE public.vercel_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vercel connection"
  ON public.vercel_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.supabase_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supabase_username text,
  access_token text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supabase_connections_user_id_key ON public.supabase_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_supabase_connections_user ON public.supabase_connections (user_id);

ALTER TABLE public.supabase_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own supabase connection"
  ON public.supabase_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
