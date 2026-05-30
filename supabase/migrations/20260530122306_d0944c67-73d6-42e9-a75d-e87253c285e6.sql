ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_friendly boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_matches_is_friendly ON public.matches(is_friendly);