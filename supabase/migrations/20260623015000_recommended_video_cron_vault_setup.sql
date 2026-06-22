create extension if not exists supabase_vault with schema vault;

create or replace function public.hq_configure_recommended_video_cron(
  p_project_url text,
  p_service_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(trim(p_project_url), '') = '' or coalesce(trim(p_service_role_key), '') = '' then
    raise exception 'Project URL and service role key are required';
  end if;

  delete from vault.secrets
  where name in ('project_url', 'service_role_key');

  perform vault.create_secret(trim(p_project_url), 'project_url', 'Recommended video Cron project URL');
  perform vault.create_secret(trim(p_service_role_key), 'service_role_key', 'Recommended video Cron service role key');

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.hq_configure_recommended_video_cron(text, text) from public, anon, authenticated;
grant execute on function public.hq_configure_recommended_video_cron(text, text) to service_role;
