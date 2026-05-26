
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS external_match_id TEXT;
CREATE INDEX IF NOT EXISTS idx_matches_external_match_id ON public.matches(external_match_id) WHERE external_match_id IS NOT NULL;

-- Habilita extensões necessárias para o agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
