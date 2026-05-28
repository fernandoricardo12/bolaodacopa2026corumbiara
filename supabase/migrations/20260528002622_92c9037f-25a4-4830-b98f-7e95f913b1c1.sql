-- Concede permissões para uso do cron pelo postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove agendamento anterior, se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-scores-auto-every-minute') THEN
    PERFORM cron.unschedule('sync-scores-auto-every-minute');
  END IF;
END $$;

-- Agenda nova chamada a cada 1 minuto
SELECT cron.schedule(
  'sync-scores-auto-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6884546e-c53f-467c-a776-c50d49a56138.lovable.app/api/public/sync-scores-auto',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);