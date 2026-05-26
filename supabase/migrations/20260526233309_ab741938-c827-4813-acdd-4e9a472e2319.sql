
SELECT cron.unschedule('sync-football-scores') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-football-scores');

SELECT cron.schedule(
  'sync-football-scores',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6884546e-c53f-467c-a776-c50d49a56138.lovable.app/api/public/sync-scores',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
