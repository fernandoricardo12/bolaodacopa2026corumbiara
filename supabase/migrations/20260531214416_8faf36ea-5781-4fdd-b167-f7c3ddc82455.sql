ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS live_clock text,
  ADD COLUMN IF NOT EXISTS live_period integer,
  ADD COLUMN IF NOT EXISTS live_status_detail text;