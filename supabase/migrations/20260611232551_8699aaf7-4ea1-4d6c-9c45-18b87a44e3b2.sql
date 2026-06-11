
-- 1. Permitir apostas de R$2 ou R$5 e atualizar default
ALTER TABLE public.individual_bets
  ADD CONSTRAINT individual_bets_amount_check CHECK (amount IN (2, 5));

-- 2. Remover rollover automático ligado à Seleção (b\u00f4nus passa a ser definido pelo admin)
DROP TRIGGER IF EXISTS trg_rollover_friendly_bonus ON public.matches;
DROP FUNCTION IF EXISTS public.rollover_friendly_bonus();

-- 3. Novo cálculo de payouts: pool único proporcional ao valor apostado;
--    bônus extra dividido só entre quem cravou placar exato com aposta >= R$ 5.
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
  winner_amount_total numeric := 0;
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
    -- prêmio principal (80% do bolo) proporcional ao valor apostado
    UPDATE public.individual_bets
      SET payout = (total_pool * 0.80) * (amount / exact_amount_total)
      WHERE match_id = _match_id AND paid = true
        AND home_score = result_home AND away_score = result_away;

    -- bônus extra: dividido igualmente entre os que apostaram >= R$ 5 e cravaram
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
    RETURN;
  END IF;

  IF total_pool > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO winner_amount_total
    FROM public.individual_bets
    WHERE match_id = _match_id AND paid = true
      AND sign(home_score - away_score) = sign(result_home - result_away);

    IF winner_amount_total > 0 THEN
      UPDATE public.individual_bets
        SET payout = (total_pool * 0.60) * (amount / winner_amount_total)
        WHERE match_id = _match_id AND paid = true
          AND sign(home_score - away_score) = sign(result_home - result_away);
    END IF;
  END IF;
END
$function$;

-- 4. Atualizar admin_set_payment_status para alocar palpites de valores variáveis (R$2 ou R$5)
CREATE OR REPLACE FUNCTION public.admin_set_payment_status(_payment_id uuid, _status payment_status)
 RETURNS TABLE(payment_id uuid, new_status payment_status, marked_bets integer, credited_amount numeric, unapplied_amount numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_marked integer := 0;
  v_credit numeric := 0;
  v_unapplied numeric := 0;
  v_remaining numeric := 0;
  v_bet record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem confirmar pagamentos';
  END IF;

  IF _status NOT IN ('confirmed'::public.payment_status, 'rejected'::public.payment_status) THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = _payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado';
  END IF;

  IF _status = 'rejected'::public.payment_status THEN
    UPDATE public.individual_bets ib
    SET paid = false
    FROM public.payment_bet_allocations pba
    WHERE pba.individual_bet_id = ib.id
      AND pba.payment_id = _payment_id;

    DELETE FROM public.payment_bet_allocations
    WHERE payment_bet_allocations.payment_id = _payment_id;

    UPDATE public.payments
    SET status = _status,
        confirmed_at = now(),
        confirmed_by = auth.uid()
    WHERE id = _payment_id;

    RETURN QUERY SELECT _payment_id, _status, 0, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  UPDATE public.payments
  SET status = _status,
      confirmed_at = now(),
      confirmed_by = auth.uid()
  WHERE id = _payment_id;

  IF v_payment.mode = 'individual'::public.bet_mode THEN
    v_remaining := COALESCE(v_payment.amount, 0);

    FOR v_bet IN
      SELECT ib.id, ib.amount
      FROM public.individual_bets ib
      LEFT JOIN public.payment_bet_allocations pba ON pba.individual_bet_id = ib.id
      WHERE ib.user_id = v_payment.user_id
        AND ib.paid = false
        AND pba.individual_bet_id IS NULL
        AND (v_payment.match_id IS NULL OR ib.match_id = v_payment.match_id)
      ORDER BY ib.amount DESC, ib.created_at ASC, ib.id ASC
    LOOP
      IF v_bet.amount <= v_remaining THEN
        INSERT INTO public.payment_bet_allocations (payment_id, individual_bet_id, amount)
        VALUES (_payment_id, v_bet.id, v_bet.amount)
        ON CONFLICT DO NOTHING;

        UPDATE public.individual_bets SET paid = true WHERE id = v_bet.id;

        v_marked := v_marked + 1;
        v_credit := v_credit + v_bet.amount;
        v_remaining := v_remaining - v_bet.amount;
      END IF;
      EXIT WHEN v_remaining < 2;
    END LOOP;

    v_unapplied := GREATEST(v_remaining, 0);
  END IF;

  RETURN QUERY SELECT _payment_id, _status, v_marked, v_credit, v_unapplied;
END
$function$;
