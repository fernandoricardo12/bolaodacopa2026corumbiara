
-- 1) Prevent duplicate individual bets (same user, match, score)
ALTER TABLE public.individual_bets
  DROP CONSTRAINT IF EXISTS individual_bets_unique_score_per_user_match;
ALTER TABLE public.individual_bets
  ADD CONSTRAINT individual_bets_unique_score_per_user_match
  UNIQUE (user_id, match_id, home_score, away_score);

-- 2) Update amount check: only R$5 going forward (existing rows kept via NOT VALID)
ALTER TABLE public.individual_bets
  DROP CONSTRAINT IF EXISTS individual_bets_amount_check;
ALTER TABLE public.individual_bets
  ADD CONSTRAINT individual_bets_amount_check CHECK (amount = 5) NOT VALID;

-- 3) Fix R$2 leftover in admin_set_payment_status
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

  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado';
  END IF;

  IF _status = 'rejected'::public.payment_status THEN
    UPDATE public.individual_bets ib
    SET paid = false
    FROM public.payment_bet_allocations pba
    WHERE pba.individual_bet_id = ib.id AND pba.payment_id = _payment_id;

    DELETE FROM public.payment_bet_allocations WHERE payment_bet_allocations.payment_id = _payment_id;

    UPDATE public.payments
    SET status = _status, confirmed_at = now(), confirmed_by = auth.uid()
    WHERE id = _payment_id;

    RETURN QUERY SELECT _payment_id, _status, 0, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  UPDATE public.payments
  SET status = _status, confirmed_at = now(), confirmed_by = auth.uid()
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
      EXIT WHEN v_remaining < 5;
    END LOOP;

    v_unapplied := GREATEST(v_remaining, 0);
  END IF;

  RETURN QUERY SELECT _payment_id, _status, v_marked, v_credit, v_unapplied;
END
$function$;
