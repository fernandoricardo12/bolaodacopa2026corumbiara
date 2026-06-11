CREATE OR REPLACE FUNCTION public.check_bet_kickoff_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE m_kickoff timestamptz; m_finished boolean;
BEGIN
  SELECT kickoff, finished INTO m_kickoff, m_finished FROM public.matches WHERE id = NEW.match_id;
  IF m_kickoff IS NULL THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  IF m_finished THEN RAISE EXCEPTION 'Partida já encerrada'; END IF;
  IF m_kickoff <= now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'Palpites encerrados (fechamos 10 minutos antes do início da partida)';
  END IF;
  RETURN NEW;
END $function$;