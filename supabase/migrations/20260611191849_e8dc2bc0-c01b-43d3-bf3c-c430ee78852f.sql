
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
    UPDATE public.bets SET points = 0 WHERE match_id = NEW.id AND points <> 0;
  END IF;
  RETURN NEW;
END $function$;
