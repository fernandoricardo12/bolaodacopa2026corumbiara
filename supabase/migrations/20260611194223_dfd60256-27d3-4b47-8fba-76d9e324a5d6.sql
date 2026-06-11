CREATE OR REPLACE FUNCTION public.calc_points(b_home integer, b_away integer, r_home integer, r_away integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  exact_score boolean;
  winner_ok boolean;
  one_score_ok boolean;
BEGIN
  IF b_home IS NULL OR b_away IS NULL OR r_home IS NULL OR r_away IS NULL THEN
    RETURN 0;
  END IF;

  exact_score := (b_home = r_home AND b_away = r_away);
  IF exact_score THEN RETURN 20; END IF;

  winner_ok := sign(b_home - b_away) = sign(r_home - r_away);
  one_score_ok := (b_home = r_home) OR (b_away = r_away);

  IF winner_ok AND one_score_ok THEN RETURN 15; END IF;
  IF winner_ok THEN RETURN 10; END IF;
  IF one_score_ok THEN RETURN 5; END IF;

  RETURN 0;
END
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_bets_for_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.bets
  SET points = CASE
    WHEN NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
      THEN public.calc_points(home_score, away_score, NEW.home_score, NEW.away_score)
    ELSE 0
  END,
  updated_at = now()
  WHERE match_id = NEW.id;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.set_bet_points_from_current_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_home integer;
  result_away integer;
BEGIN
  SELECT home_score, away_score
    INTO result_home, result_away
  FROM public.matches
  WHERE id = NEW.match_id;

  NEW.points := public.calc_points(NEW.home_score, NEW.away_score, result_home, result_away);
  RETURN NEW;
END
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bets_points_allowed'
      AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE public.bets
      ADD CONSTRAINT bets_points_allowed CHECK (points IN (0, 5, 10, 15, 20)) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.bets VALIDATE CONSTRAINT bets_points_allowed;

DROP TRIGGER IF EXISTS recalc_bets ON public.matches;
DROP TRIGGER IF EXISTS trg_recalc_bets ON public.matches;
DROP TRIGGER IF EXISTS recalculate_bets_for_match_on_match ON public.matches;
DROP TRIGGER IF EXISTS matches_recalculate_bets_for_match ON public.matches;
CREATE TRIGGER matches_recalculate_bets_for_match
AFTER INSERT OR UPDATE OF home_score, away_score, finished
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_bets_for_match();

DROP TRIGGER IF EXISTS bets_check_kickoff_window ON public.bets;
DROP TRIGGER IF EXISTS check_bets_kickoff_window ON public.bets;
CREATE TRIGGER bets_check_kickoff_window
BEFORE INSERT OR UPDATE OF match_id, home_score, away_score ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.check_bet_kickoff_window();

DROP TRIGGER IF EXISTS bets_set_points_from_current_match ON public.bets;
CREATE TRIGGER bets_set_points_from_current_match
BEFORE INSERT OR UPDATE OF match_id, home_score, away_score ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.set_bet_points_from_current_match();

DROP TRIGGER IF EXISTS individual_bets_check_kickoff_window ON public.individual_bets;
DROP TRIGGER IF EXISTS check_individual_bets_kickoff_window ON public.individual_bets;
CREATE TRIGGER individual_bets_check_kickoff_window
BEFORE INSERT OR UPDATE OF match_id, home_score, away_score ON public.individual_bets
FOR EACH ROW
EXECUTE FUNCTION public.check_bet_kickoff_window();

DROP TRIGGER IF EXISTS trg_recalc_payouts_match ON public.matches;
DROP TRIGGER IF EXISTS recalculate_individual_payouts_on_match ON public.matches;
CREATE TRIGGER recalculate_individual_payouts_on_match
AFTER UPDATE OF finished, home_score, away_score ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_individual_payouts();

REVOKE ALL ON FUNCTION public.set_bet_points_from_current_match() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_bet_points_from_current_match() FROM anon;
REVOKE ALL ON FUNCTION public.set_bet_points_from_current_match() FROM authenticated;