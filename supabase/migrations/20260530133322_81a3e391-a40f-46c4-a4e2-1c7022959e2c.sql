DO $$
BEGIN
  PERFORM cron.unschedule('sync-scores-auto-every-2min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-scores-auto-every-2min',
  '*/2 * * * *',
  $cron$
  SELECT net.http_get(
    url := 'https://bolaodacopa2026corumbiara.lovable.app/api/public/sync-scores-auto',
    timeout_milliseconds := 25000
  );
  $cron$
);