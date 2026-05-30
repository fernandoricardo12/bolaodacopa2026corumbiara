ALTER TABLE public.individual_bets
ADD COLUMN IF NOT EXISTS payout_paid boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS payout_paid_at timestamptz;

DROP POLICY IF EXISTS "Users update own pre-kickoff ind" ON public.individual_bets;
CREATE POLICY "Users update own pre-kickoff ind"
ON public.individual_bets
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND paid = false
  AND payout_paid = false
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
  AND payout_paid = false
);