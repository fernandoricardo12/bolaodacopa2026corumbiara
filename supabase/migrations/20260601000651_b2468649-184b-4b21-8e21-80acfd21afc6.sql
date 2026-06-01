
-- Coluna de premiação extra (bônus do administrador) por partida
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS bonus_prize numeric NOT NULL DEFAULT 0;

-- Recalcular payouts: placar exato leva 80% do bolo + o bônus integral (dividido).
-- Só vencedor continua levando 60% do bolo. Se ninguém cravar exato, o bônus fica acumulado na partida (não vira payout).
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
  bonus numeric := 0;
  exact_count integer;
  winner_count integer;
  exact_share numeric := 0;
  winner_share numeric := 0;
BEGIN
  SELECT finished, home_score, away_score, COALESCE(bonus_prize, 0)
    INTO match_finished, result_home, result_away, bonus
  FROM public.matches
  WHERE id = _match_id;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.individual_bets SET payout = 0 WHERE match_id = _match_id;

  IF match_finished IS DISTINCT FROM true OR result_home IS NULL OR result_away IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM public.individual_bets WHERE match_id = _match_id AND paid = true;

  SELECT COUNT(*) INTO exact_count
  FROM public.individual_bets
  WHERE match_id = _match_id AND paid = true
    AND home_score = result_home AND away_score = result_away;

  IF exact_count > 0 THEN
    exact_share := ((total_pool * 0.80) + bonus) / exact_count;
    UPDATE public.individual_bets
      SET payout = exact_share
      WHERE match_id = _match_id AND paid = true
        AND home_score = result_home AND away_score = result_away;
    RETURN;
  END IF;

  IF total_pool > 0 THEN
    SELECT COUNT(*) INTO winner_count
    FROM public.individual_bets
    WHERE match_id = _match_id AND paid = true
      AND sign(home_score - away_score) = sign(result_home - result_away);

    IF winner_count > 0 THEN
      winner_share := (total_pool * 0.60) / winner_count;
      UPDATE public.individual_bets
        SET payout = winner_share
        WHERE match_id = _match_id AND paid = true
          AND sign(home_score - away_score) = sign(result_home - result_away);
    END IF;
  END IF;
END
$function$;

-- Trigger: quando uma partida terminar SEM ninguém cravar o placar exato,
-- transfere o bônus para a próxima partida amistosa da Seleção Brasileira
-- (jogo is_friendly futuro envolvendo o time com code='BRA').
CREATE OR REPLACE FUNCTION public.rollover_friendly_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bra_id uuid;
  exact_count integer;
  next_match uuid;
BEGIN
  IF NEW.finished = true
     AND (OLD.finished IS DISTINCT FROM true)
     AND NEW.is_friendly = true
     AND COALESCE(NEW.bonus_prize, 0) > 0
     AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN

    SELECT id INTO bra_id FROM public.teams WHERE upper(code) = 'BRA' LIMIT 1;
    IF bra_id IS NULL THEN RETURN NEW; END IF;

    IF NEW.home_team_id <> bra_id AND NEW.away_team_id <> bra_id THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO exact_count
    FROM public.individual_bets
    WHERE match_id = NEW.id AND paid = true
      AND home_score = NEW.home_score AND away_score = NEW.away_score;

    IF exact_count > 0 THEN RETURN NEW; END IF;

    SELECT id INTO next_match
    FROM public.matches
    WHERE is_friendly = true
      AND finished = false
      AND kickoff > NEW.kickoff
      AND (home_team_id = bra_id OR away_team_id = bra_id)
      AND id <> NEW.id
    ORDER BY kickoff ASC
    LIMIT 1;

    IF next_match IS NOT NULL THEN
      UPDATE public.matches
        SET bonus_prize = COALESCE(bonus_prize, 0) + NEW.bonus_prize
        WHERE id = next_match;
      UPDATE public.matches SET bonus_prize = 0 WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rollover_friendly_bonus ON public.matches;
CREATE TRIGGER trg_rollover_friendly_bonus
AFTER UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.rollover_friendly_bonus();

-- Garante que recálculo rode quando bonus_prize/placar mudarem
DROP TRIGGER IF EXISTS trg_recalc_payouts_match ON public.matches;
CREATE TRIGGER trg_recalc_payouts_match
AFTER UPDATE OF home_score, away_score, finished, bonus_prize ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.recalculate_individual_payouts();
