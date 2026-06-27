
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_external_match_id_key;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_external_match_id_key UNIQUE (external_match_id);

CREATE OR REPLACE FUNCTION public.sync_knockout_to_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage public.match_stage;
  v_ext text;
  v_kickoff timestamptz;
BEGIN
  IF NEW.home_team_id IS NULL OR NEW.away_team_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.home_team_id = NEW.away_team_id THEN RETURN NEW; END IF;

  v_stage := lower(NEW.round::text)::public.match_stage;
  v_ext := 'ko:' || NEW.round::text || '-' || NEW.position::text;
  v_kickoff := COALESCE(NEW.kickoff, now() + interval '30 days');

  INSERT INTO public.matches (
    external_match_id, stage, home_team_id, away_team_id,
    kickoff, venue, home_score, away_score, finished
  )
  VALUES (
    v_ext, v_stage, NEW.home_team_id, NEW.away_team_id,
    v_kickoff, NEW.venue, NEW.home_score, NEW.away_score, NEW.finished
  )
  ON CONFLICT (external_match_id) DO UPDATE
    SET home_team_id = EXCLUDED.home_team_id,
        away_team_id = EXCLUDED.away_team_id,
        kickoff      = EXCLUDED.kickoff,
        venue        = COALESCE(EXCLUDED.venue, public.matches.venue),
        home_score   = EXCLUDED.home_score,
        away_score   = EXCLUDED.away_score,
        finished     = EXCLUDED.finished,
        stage        = EXCLUDED.stage;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS knockout_sync_to_matches ON public.knockout_matches;
CREATE TRIGGER knockout_sync_to_matches
AFTER INSERT OR UPDATE ON public.knockout_matches
FOR EACH ROW EXECUTE FUNCTION public.sync_knockout_to_matches();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.knockout_matches
           WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
             AND home_team_id <> away_team_id
  LOOP
    INSERT INTO public.matches (
      external_match_id, stage, home_team_id, away_team_id,
      kickoff, venue, home_score, away_score, finished
    )
    VALUES (
      'ko:' || r.round::text || '-' || r.position::text,
      lower(r.round::text)::public.match_stage,
      r.home_team_id, r.away_team_id,
      COALESCE(r.kickoff, now() + interval '30 days'),
      r.venue, r.home_score, r.away_score, r.finished
    )
    ON CONFLICT (external_match_id) DO UPDATE
      SET home_team_id = EXCLUDED.home_team_id,
          away_team_id = EXCLUDED.away_team_id,
          kickoff      = EXCLUDED.kickoff,
          venue        = COALESCE(EXCLUDED.venue, public.matches.venue),
          stage        = EXCLUDED.stage;
  END LOOP;
END $$;
