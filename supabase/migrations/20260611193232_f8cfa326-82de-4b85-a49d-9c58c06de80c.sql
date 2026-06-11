DROP TRIGGER IF EXISTS recalc_bets ON public.matches;
DROP TRIGGER IF EXISTS recalculate_bets_for_match_on_match ON public.matches;
DROP TRIGGER IF EXISTS trg_recalc_bets ON public.matches;

DROP TRIGGER IF EXISTS matches_recalculate_bets_for_match ON public.matches;
CREATE TRIGGER matches_recalculate_bets_for_match
AFTER INSERT OR UPDATE OF home_score, away_score, finished
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_bets_for_match();