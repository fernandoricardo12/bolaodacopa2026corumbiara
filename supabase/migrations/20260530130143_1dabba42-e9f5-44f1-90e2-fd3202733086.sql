REVOKE EXECUTE ON FUNCTION public.recalculate_bets_for_match() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_individual_payouts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_individual_payouts_from_bet() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_individual_payouts_for_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_bet_kickoff_window() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_knockout() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_participant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, public.payment_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, public.payment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_individual_payouts_for_match(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users update own pre-kickoff ind" ON public.individual_bets;
CREATE POLICY "Users update own pre-kickoff ind"
ON public.individual_bets
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND paid = false
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = individual_bets.match_id
      AND m.finished = false
      AND m.kickoff > now() + interval '1 hour'
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND paid = false
);