CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts_for_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_finished boolean;
  result_home integer;
  result_away integer;
  total_pool numeric;
  exact_count integer;
  winner_count integer;
  exact_share numeric := 0;
  winner_share numeric := 0;
BEGIN
  SELECT finished, home_score, away_score
    INTO match_finished, result_home, result_away
  FROM public.matches
  WHERE id = _match_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.individual_bets
  SET payout = 0
  WHERE match_id = _match_id;

  IF match_finished IS DISTINCT FROM true OR result_home IS NULL OR result_away IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO total_pool
  FROM public.individual_bets
  WHERE match_id = _match_id
    AND paid = true;

  IF total_pool <= 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO exact_count
  FROM public.individual_bets
  WHERE match_id = _match_id
    AND paid = true
    AND home_score = result_home
    AND away_score = result_away;

  IF exact_count > 0 THEN
    exact_share := (total_pool * 0.80) / exact_count;

    UPDATE public.individual_bets
    SET payout = exact_share
    WHERE match_id = _match_id
      AND paid = true
      AND home_score = result_home
      AND away_score = result_away;

    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO winner_count
  FROM public.individual_bets
  WHERE match_id = _match_id
    AND paid = true
    AND sign(home_score - away_score) = sign(result_home - result_away);

  IF winner_count > 0 THEN
    winner_share := (total_pool * 0.60) / winner_count;

    UPDATE public.individual_bets
    SET payout = winner_share
    WHERE match_id = _match_id
      AND paid = true
      AND sign(home_score - away_score) = sign(result_home - result_away);
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.recalculate_individual_payouts_for_match(NEW.id);
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts_from_bet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_individual_payouts_for_match(OLD.match_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_individual_payouts_for_match(NEW.match_id);

  IF TG_OP = 'UPDATE' AND OLD.match_id IS DISTINCT FROM NEW.match_id THEN
    PERFORM public.recalculate_individual_payouts_for_match(OLD.match_id);
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_recalc_payouts ON public.matches;
DROP TRIGGER IF EXISTS recalculate_individual_payouts_on_match ON public.matches;
CREATE TRIGGER recalculate_individual_payouts_on_match
AFTER UPDATE OF finished, home_score, away_score ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_individual_payouts();

DROP TRIGGER IF EXISTS recalculate_individual_payouts_on_bet ON public.individual_bets;
CREATE TRIGGER recalculate_individual_payouts_on_bet
AFTER INSERT OR UPDATE OF paid, amount, home_score, away_score, match_id OR DELETE ON public.individual_bets
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_individual_payouts_from_bet();