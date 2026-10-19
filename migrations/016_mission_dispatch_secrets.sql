-- Secrets needed by the trusted Supabase dispatcher are exposed only to service_role.
create or replace function public.get_mission_dispatch_secrets()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'cron_secret', (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'kyvorix_mission_worker_secret'
      limit 1
    ),
    'vercel_bypass_secret', (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'kyvorix_vercel_bypass_secret'
      limit 1
    ),
    'worker_url', (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'kyvorix_mission_worker_url'
      limit 1
    )
  );
$$;

revoke all on function public.get_mission_dispatch_secrets() from public, anon, authenticated;
grant execute on function public.get_mission_dispatch_secrets() to service_role;
