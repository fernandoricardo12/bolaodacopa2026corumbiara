DROP POLICY IF EXISTS "Users update own pre-kickoff ind" ON public.individual_bets;
CREATE POLICY "Users update own pre-kickoff ind"
ON public.individual_bets
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND payout_paid = false
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = individual_bets.match_id
      AND m.finished = false
      AND m.kickoff > now() + interval '10 minutes'
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND payout_paid = false
);