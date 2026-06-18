ALTER TABLE public.individual_bets ALTER COLUMN amount SET DEFAULT 5;
UPDATE public.matches SET allow_two_bets = false WHERE allow_two_bets = true;