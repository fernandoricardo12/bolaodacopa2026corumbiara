
REVOKE EXECUTE ON FUNCTION public.recalculate_individual_payouts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_bets_for_match() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Admins update individual bets" ON public.individual_bets;
CREATE POLICY "Admins update individual bets" ON public.individual_bets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
