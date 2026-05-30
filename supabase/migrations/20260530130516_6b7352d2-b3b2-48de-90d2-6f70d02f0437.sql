CREATE OR REPLACE FUNCTION public.admin_set_payment_status(_payment_id uuid, _status public.payment_status)
RETURNS TABLE(payment_id uuid, new_status public.payment_status, marked_bets integer, credited_amount numeric, unapplied_amount numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_qty integer := 0;
  v_marked integer := 0;
  v_credit numeric := 0;
  v_unapplied numeric := 0;
  affected_match_ids uuid[] := ARRAY[]::uuid[];
  affected_match_id uuid;
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
    SELECT COALESCE(array_agg(DISTINCT ib.match_id), ARRAY[]::uuid[]) INTO affected_match_ids
    FROM public.payment_bet_allocations pba
    JOIN public.individual_bets ib ON ib.id = pba.individual_bet_id
    WHERE pba.payment_id = _payment_id;

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

    FOREACH affected_match_id IN ARRAY affected_match_ids LOOP
      PERFORM public.recalculate_individual_payouts_for_match(affected_match_id);
    END LOOP;

    RETURN QUERY SELECT _payment_id, _status, 0, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  UPDATE public.payments
  SET status = _status,
      confirmed_at = now(),
      confirmed_by = auth.uid()
  WHERE id = _payment_id;

  IF v_payment.mode = 'individual'::public.bet_mode THEN
    v_qty := GREATEST(FLOOR(COALESCE(v_payment.amount, 0) / 2), 0)::integer;

    WITH candidates AS (
      SELECT ib.id, ib.match_id
      FROM public.individual_bets ib
      LEFT JOIN public.payment_bet_allocations pba ON pba.individual_bet_id = ib.id
      WHERE ib.user_id = v_payment.user_id
        AND ib.paid = false
        AND pba.individual_bet_id IS NULL
        AND (v_payment.match_id IS NULL OR ib.match_id = v_payment.match_id)
      ORDER BY ib.created_at ASC, ib.id ASC
      LIMIT v_qty
    ), inserted AS (
      INSERT INTO public.payment_bet_allocations (payment_id, individual_bet_id, amount)
      SELECT _payment_id, candidates.id, 2
      FROM candidates
      ON CONFLICT DO NOTHING
      RETURNING individual_bet_id
    ), marked AS (
      UPDATE public.individual_bets ib
      SET paid = true
      FROM inserted
      WHERE ib.id = inserted.individual_bet_id
      RETURNING ib.id, ib.match_id, ib.amount
    )
    SELECT COUNT(*), COALESCE(SUM(amount), 0), COALESCE(array_agg(DISTINCT match_id), ARRAY[]::uuid[])
      INTO v_marked, v_credit, affected_match_ids
    FROM marked;

    v_unapplied := GREATEST(COALESCE(v_payment.amount, 0) - v_credit, 0);

    FOREACH affected_match_id IN ARRAY affected_match_ids LOOP
      PERFORM public.recalculate_individual_payouts_for_match(affected_match_id);
    END LOOP;
  END IF;

  RETURN QUERY SELECT _payment_id, _status, v_marked, v_credit, v_unapplied;
END
$function$;

GRANT EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, public.payment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_individual_payouts_for_match(uuid) TO authenticated;