CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts_for_match(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m_finished boolean;
  m_featured boolean;
  m_kickoff timestamptz;
  result_home integer;
  result_away integer;
  total_pool numeric;
  bonus numeric := 0;
  exact_amount_total numeric := 0;
  accumulated_in numeric := 0;
  t_reset timestamptz;
BEGIN
  SELECT finished, featured, kickoff, home_score, away_score, COALESCE(bonus_prize, 0)
    INTO m_finished, m_featured, m_kickoff, result_home, result_away, bonus
  FROM public.matches
  WHERE id = _match_id;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.individual_bets SET payout = 0 WHERE match_id = _match_id;

  IF m_finished IS DISTINCT FROM true OR result_home IS NULL OR result_away IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM public.individual_bets WHERE match_id = _match_id AND paid = true;

  SELECT COALESCE(SUM(amount), 0) INTO exact_amount_total
  FROM public.individual_bets
  WHERE match_id = _match_id AND paid = true
    AND home_score = result_home AND away_score = result_away;

  IF m_featured THEN
    SELECT MAX(m2.kickoff) INTO t_reset
    FROM public.matches m2
    WHERE m2.featured = true
      AND m2.finished = true
      AND m2.kickoff < m_kickoff
      AND m2.home_score IS NOT NULL AND m2.away_score IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.individual_bets ib
        WHERE ib.match_id = m2.id AND ib.paid = true
          AND ib.home_score = m2.home_score AND ib.away_score = m2.away_score
      );

    SELECT COALESCE(SUM(pool_paid * 0.80), 0) INTO accumulated_in
    FROM (
      SELECT m3.id, COALESCE(SUM(ib.amount), 0) AS pool_paid
      FROM public.matches m3
      LEFT JOIN public.individual_bets ib ON ib.match_id = m3.id AND ib.paid = true
      WHERE m3.featured = true
        AND m3.finished = true
        AND m3.kickoff < m_kickoff
        AND (t_reset IS NULL OR m3.kickoff > t_reset)
        AND m3.home_score IS NOT NULL AND m3.away_score IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.individual_bets ib2
          WHERE ib2.match_id = m3.id AND ib2.paid = true
            AND ib2.home_score = m3.home_score AND ib2.away_score = m3.away_score
        )
      GROUP BY m3.id
    ) s;
  END IF;

  IF exact_amount_total > 0 THEN
    -- Prêmio = 80% do bolo atual + acumulado + bônus do admin, proporcional ao valor apostado por quem cravou
    UPDATE public.individual_bets
      SET payout = ((total_pool * 0.80) + accumulated_in + bonus) * (amount / exact_amount_total)
      WHERE match_id = _match_id AND paid = true
        AND home_score = result_home AND away_score = result_away;
  END IF;
END
$function$;