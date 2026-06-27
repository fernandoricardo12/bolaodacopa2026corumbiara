SELECT cron.schedule(
  'sync-knockout-auto-every-10min',
  '*/10 * * * *',
  $$ SELECT net.http_get(
    url := 'https://bolaodacopa2026corumbiara.lovable.app/api/public/sync-knockout-auto',
    timeout_milliseconds := 25000
  ); $$
);