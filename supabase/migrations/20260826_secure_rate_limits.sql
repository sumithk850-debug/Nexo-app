-- Rate-limit rows contain per-account usage and pause state. They are written and
-- read only by server route handlers using the service-role client; browsers must
-- never be able to enumerate, alter, or create these rows directly.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "anon all rate_limits" ON public.rate_limits;
