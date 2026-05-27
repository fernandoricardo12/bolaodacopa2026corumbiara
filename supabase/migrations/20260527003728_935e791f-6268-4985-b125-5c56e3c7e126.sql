
DROP POLICY IF EXISTS "Users update own bets pre-kickoff" ON public.bets;
CREATE POLICY "Users update own bets pre-kickoff"
ON public.bets FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = bets.match_id AND m.finished = false
      AND m.kickoff > now() + interval '1 hour'
  )
)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own pre-kickoff ind" ON public.individual_bets;
CREATE POLICY "Users delete own pre-kickoff ind"
ON public.individual_bets FOR DELETE TO authenticated
USING (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = individual_bets.match_id AND m.finished = false
      AND m.kickoff > now() + interval '1 hour'
  )
);

DROP POLICY IF EXISTS "Users update own pre-kickoff ind" ON public.individual_bets;
CREATE POLICY "Users update own pre-kickoff ind"
ON public.individual_bets FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = individual_bets.match_id AND m.finished = false
      AND m.kickoff > now() + interval '1 hour'
  )
)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_bet_kickoff_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m_kickoff timestamptz; m_finished boolean;
BEGIN
  SELECT kickoff, finished INTO m_kickoff, m_finished FROM public.matches WHERE id = NEW.match_id;
  IF m_kickoff IS NULL THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  IF m_finished THEN RAISE EXCEPTION 'Partida já encerrada'; END IF;
  IF m_kickoff <= now() + interval '1 hour' THEN
    RAISE EXCEPTION 'Palpites encerrados (fechamos 1 hora antes do início da partida)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bets_check_kickoff_window ON public.bets;
CREATE TRIGGER bets_check_kickoff_window
BEFORE INSERT ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.check_bet_kickoff_window();

DROP TRIGGER IF EXISTS individual_bets_check_kickoff_window ON public.individual_bets;
CREATE TRIGGER individual_bets_check_kickoff_window
BEFORE INSERT ON public.individual_bets
FOR EACH ROW EXECUTE FUNCTION public.check_bet_kickoff_window();
