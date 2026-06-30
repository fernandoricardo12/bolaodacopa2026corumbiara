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
  UPDATE public.bets b
  SET points = public.calc_points(b.home_score, b.away_score, NEW.home_score, NEW.away_score),
      updated_at = now()
  WHERE b.match_id = NEW.id;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS matches_recalculate_bets_for_match ON public.matches;
CREATE TRIGGER matches_recalculate_bets_for_match
AFTER INSERT OR UPDATE OF home_score, away_score, finished
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_bets_for_match();

UPDATE public.bets b
SET points = public.calc_points(b.home_score, b.away_score, m.home_score, m.away_score),
    updated_at = now()
FROM public.matches m
WHERE b.match_id = m.id;