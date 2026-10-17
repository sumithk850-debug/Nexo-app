-- Harden trigger functions without changing their trigger behavior.
-- Empty search_path prevents objects in attacker-controlled schemas from shadowing names.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, birthday)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    (NEW.raw_user_meta_data->>'birthday')::date
  );
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.touch_development_intelligence_updated_at()
  SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.touch_development_intelligence_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_development_intelligence_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.touch_development_intelligence_updated_at() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.touch_development_intelligence_updated_at() TO postgres, service_role;
