CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_pool numeric;
  exact_count integer;
  winner_count integer;
  exact_share numeric := 0;
  winner_share numeric := 0;
BEGIN
  IF NEW.finished = true AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    SELECT COALESCE(SUM(amount),0) INTO total_pool
      FROM public.individual_bets
      WHERE match_id = NEW.id AND paid = true;

    SELECT COUNT(*) INTO exact_count
      FROM public.individual_bets
      WHERE match_id = NEW.id AND paid = true
        AND home_score = NEW.home_score AND away_score = NEW.away_score;

    SELECT COUNT(*) INTO winner_count
      FROM public.individual_bets
      WHERE match_id = NEW.id AND paid = true
        AND NOT (home_score = NEW.home_score AND away_score = NEW.away_score)
        AND sign(home_score - away_score) = sign(NEW.home_score - NEW.away_score);

    -- Zera tudo do jogo
    UPDATE public.individual_bets SET payout = 0 WHERE match_id = NEW.id;

    IF exact_count > 0 THEN
      -- 80% do bolo para placares exatos, 20% fica para a administração
      exact_share := (total_pool * 0.80) / exact_count;
      UPDATE public.individual_bets SET payout = exact_share
        WHERE match_id = NEW.id AND paid = true
          AND home_score = NEW.home_score AND away_score = NEW.away_score;
    ELSIF winner_count > 0 THEN
      -- 60% para acertadores do vencedor, 40% fica para a administração
      winner_share := (total_pool * 0.60) / winner_count;
      UPDATE public.individual_bets SET payout = winner_share
        WHERE match_id = NEW.id AND paid = true
          AND NOT (home_score = NEW.home_score AND away_score = NEW.away_score)
          AND sign(home_score - away_score) = sign(NEW.home_score - NEW.away_score);
    END IF;
    -- Se ninguém acertou nem vencedor, 100% do bolo fica para a administração (nenhum payout).
  END IF;
  RETURN NEW;
END $function$;