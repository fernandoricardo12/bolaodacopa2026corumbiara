CREATE TABLE IF NOT EXISTS public.payment_bet_allocations (
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  individual_bet_id uuid NOT NULL REFERENCES public.individual_bets(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_id, individual_bet_id),
  UNIQUE (individual_bet_id)
);

GRANT SELECT ON public.payment_bet_allocations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_bet_allocations TO authenticated;
GRANT ALL ON public.payment_bet_allocations TO service_role;

ALTER TABLE public.payment_bet_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment allocations" ON public.payment_bet_allocations;
CREATE POLICY "Users can view own payment allocations"
ON public.payment_bet_allocations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_bet_allocations.payment_id
      AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Only admins manage payment allocations" ON public.payment_bet_allocations;
CREATE POLICY "Only admins manage payment allocations"
ON public.payment_bet_allocations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

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
  exact_count integer;
  winner_count integer;
  exact_share numeric := 0;
  winner_share numeric := 0;
BEGIN
  SELECT finished, home_score, away_score
    INTO match_finished, result_home, result_away
  FROM public.matches
  WHERE id = _match_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.individual_bets SET payout = 0 WHERE match_id = _match_id;

  IF match_finished IS DISTINCT FROM true OR result_home IS NULL OR result_away IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM public.individual_bets
  WHERE match_id = _match_id AND paid = true;

  SELECT COUNT(*) INTO exact_count
  FROM public.individual_bets
  WHERE match_id = _match_id AND paid = true
    AND home_score = result_home AND away_score = result_away;

  SELECT COUNT(*) INTO winner_count
  FROM public.individual_bets
  WHERE match_id = _match_id AND paid = true
    AND NOT (home_score = result_home AND away_score = result_away)
    AND sign(home_score - away_score) = sign(result_home - result_away);

  IF exact_count > 0 THEN
    exact_share := (total_pool * 0.80) / exact_count;
    UPDATE public.individual_bets SET payout = exact_share
    WHERE match_id = _match_id AND paid = true
      AND home_score = result_home AND away_score = result_away;
  ELSIF winner_count > 0 THEN
    winner_share := (total_pool * 0.60) / winner_count;
    UPDATE public.individual_bets SET payout = winner_share
    WHERE match_id = _match_id AND paid = true
      AND NOT (home_score = result_home AND away_score = result_away)
      AND sign(home_score - away_score) = sign(result_home - result_away);
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.recalculate_individual_payouts_for_match(NEW.id);
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts_from_bet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_individual_payouts_for_match(OLD.match_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_individual_payouts_for_match(NEW.match_id);

  IF TG_OP = 'UPDATE' AND OLD.match_id IS DISTINCT FROM NEW.match_id THEN
    PERFORM public.recalculate_individual_payouts_for_match(OLD.match_id);
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_payment_status(_payment_id uuid, _status public.payment_status)
RETURNS TABLE(payment_id uuid, new_status public.payment_status, marked_bets integer, credited_amount numeric, unapplied_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_qty integer := 0;
  v_marked integer := 0;
  v_credit numeric := 0;
  v_unapplied numeric := 0;
  affected_match_ids uuid[] := ARRAY[]::uuid[];
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

    FOREACH payment_id IN ARRAY affected_match_ids LOOP
      PERFORM public.recalculate_individual_payouts_for_match(payment_id);
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

    FOREACH payment_id IN ARRAY affected_match_ids LOOP
      PERFORM public.recalculate_individual_payouts_for_match(payment_id);
    END LOOP;
  END IF;

  RETURN QUERY SELECT _payment_id, _status, v_marked, v_credit, v_unapplied;
END
$function$;

GRANT EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, public.payment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_individual_payouts_for_match(uuid) TO authenticated;

DROP TRIGGER IF EXISTS recalculate_individual_payouts_on_match ON public.matches;
CREATE TRIGGER recalculate_individual_payouts_on_match
AFTER UPDATE OF finished, home_score, away_score ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_individual_payouts();

DROP TRIGGER IF EXISTS recalculate_individual_payouts_on_bet ON public.individual_bets;
CREATE TRIGGER recalculate_individual_payouts_on_bet
AFTER INSERT OR UPDATE OF paid, amount, home_score, away_score, match_id OR DELETE ON public.individual_bets
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_individual_payouts_from_bet();

DROP TRIGGER IF EXISTS recalculate_bets_for_match_on_match ON public.matches;
CREATE TRIGGER recalculate_bets_for_match_on_match
AFTER UPDATE OF finished, home_score, away_score ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_bets_for_match();

DROP TRIGGER IF EXISTS check_bets_kickoff_window ON public.bets;
CREATE TRIGGER check_bets_kickoff_window
BEFORE INSERT OR UPDATE OF match_id, home_score, away_score ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.check_bet_kickoff_window();

DROP TRIGGER IF EXISTS check_individual_bets_kickoff_window ON public.individual_bets;
CREATE TRIGGER check_individual_bets_kickoff_window
BEFORE INSERT OR UPDATE OF match_id, home_score, away_score ON public.individual_bets
FOR EACH ROW
EXECUTE FUNCTION public.check_bet_kickoff_window();