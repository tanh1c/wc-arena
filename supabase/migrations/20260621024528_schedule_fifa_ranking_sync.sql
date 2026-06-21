create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule('sync-fifa-rankings-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'sync-fifa-rankings-daily'
);

select cron.schedule(
  'sync-fifa-rankings-daily',
  '17 8 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/sync_fifa_rankings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'publishable_key'
      ),
      'x-sync-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'fifa_ranking_sync_secret'
      )
    ),
    body := jsonb_build_object('scheduledAt', now())
  );
  $$
);
