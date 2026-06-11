CREATE OR REPLACE FUNCTION public.recalculate_bets_for_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.bets
      SET points = public.calc_points(home_score, away_score, NEW.home_score, NEW.away_score)
      WHERE match_id = NEW.id;
  ELSE
    UPDATE public.bets
      SET points = 0
      WHERE match_id = NEW.id AND COALESCE(points, 0) <> 0;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS matches_recalculate_bets_for_match ON public.matches;
CREATE TRIGGER matches_recalculate_bets_for_match
AFTER INSERT OR UPDATE OF home_score, away_score, finished
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_bets_for_match();