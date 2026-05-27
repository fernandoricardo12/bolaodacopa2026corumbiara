ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_matches_featured ON public.matches(featured) WHERE featured = true;