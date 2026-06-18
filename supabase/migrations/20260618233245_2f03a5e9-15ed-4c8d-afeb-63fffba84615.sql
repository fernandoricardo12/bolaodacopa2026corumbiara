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
  exact_amount_total numeric := 0;
  premium_exact_count integer := 0;
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

  SELECT COALESCE(SUM(amount), 0) INTO exact_amount_total
  FROM public.individual_bets
  WHERE match_id = _match_id AND paid = true
    AND home_score = result_home AND away_score = result_away;

  IF exact_amount_total > 0 THEN
    -- Prêmio principal: 80% do bolo, proporcional ao valor apostado por quem cravou
    UPDATE public.individual_bets
      SET payout = (total_pool * 0.80) * (amount / exact_amount_total)
      WHERE match_id = _match_id AND paid = true
        AND home_score = result_home AND away_score = result_away;

    -- Bônus extra: dividido igualmente entre quem apostou >= R$ 5 e cravou
    IF bonus > 0 THEN
      SELECT COUNT(*) INTO premium_exact_count
      FROM public.individual_bets
      WHERE match_id = _match_id AND paid = true
        AND home_score = result_home AND away_score = result_away
        AND amount >= 5;

      IF premium_exact_count > 0 THEN
        UPDATE public.individual_bets
          SET payout = payout + (bonus / premium_exact_count)
          WHERE match_id = _match_id AND paid = true
            AND home_score = result_home AND away_score = result_away
            AND amount >= 5;
      END IF;
    END IF;
  END IF;

  -- Se ninguém cravou o placar exato, não há prêmio (sem regra de "só vencedor", sem acúmulo)
END
$function$;