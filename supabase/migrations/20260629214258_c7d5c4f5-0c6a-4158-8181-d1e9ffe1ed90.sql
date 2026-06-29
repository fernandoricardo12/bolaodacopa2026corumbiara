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
  v_ext := 'ko:' || NEW.round::text || '-' || NEW.position::text;

  IF NEW.home_team_id IS NULL OR NEW.away_team_id IS NULL OR NEW.home_team_id = NEW.away_team_id THEN
    DELETE FROM public.matches
    WHERE external_match_id = v_ext
      AND NOT EXISTS (
        SELECT 1 FROM public.bets b WHERE b.match_id = public.matches.id
      );
    RETURN NEW;
  END IF;

  v_stage := lower(NEW.round::text)::public.match_stage;
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

UPDATE public.knockout_matches
SET home_source = source_map.home_source,
    away_source = source_map.away_source,
    label = source_map.label,
    kickoff = source_map.kickoff::timestamptz,
    venue = source_map.venue,
    home_team_id = NULL,
    away_team_id = NULL,
    home_score = NULL,
    away_score = NULL,
    finished = false
FROM (VALUES
  (1, 'Jogo 89', 'W:R32-3',  'W:R32-6',  '2026-07-04T21:00:00Z', 'Philadelphia'),
  (2, 'Jogo 90', 'W:R32-1',  'W:R32-4',  '2026-07-04T17:00:00Z', 'Houston'),
  (3, 'Jogo 91', 'W:R32-2',  'W:R32-5',  '2026-07-05T20:00:00Z', 'East Rutherford'),
  (4, 'Jogo 92', 'W:R32-7',  'W:R32-8',  '2026-07-06T00:00:00Z', 'Cidade do México'),
  (5, 'Jogo 93', 'W:R32-12', 'W:R32-11', '2026-07-06T19:00:00Z', 'Arlington'),
  (6, 'Jogo 94', 'W:R32-10', 'W:R32-9',  '2026-07-07T00:00:00Z', 'Seattle'),
  (7, 'Jogo 95', 'W:R32-15', 'W:R32-14', '2026-07-07T16:00:00Z', 'Atlanta'),
  (8, 'Jogo 96', 'W:R32-13', 'W:R32-16', '2026-07-07T20:00:00Z', 'Vancouver')
) AS source_map(position, label, home_source, away_source, kickoff, venue)
WHERE public.knockout_matches.round = 'R16'
  AND public.knockout_matches.position = source_map.position;

WITH r32_winners AS (
  SELECT position,
         CASE
           WHEN finished AND home_score IS NOT NULL AND away_score IS NOT NULL AND home_score > away_score THEN home_team_id
           WHEN finished AND home_score IS NOT NULL AND away_score IS NOT NULL AND away_score > home_score THEN away_team_id
           ELSE NULL
         END AS winner_id
  FROM public.knockout_matches
  WHERE round = 'R32'
)
UPDATE public.knockout_matches km
SET home_team_id = home_winner.winner_id,
    away_team_id = away_winner.winner_id
FROM r32_winners home_winner, r32_winners away_winner
WHERE km.round = 'R16'
  AND ('W:R32-' || home_winner.position::text) = km.home_source
  AND ('W:R32-' || away_winner.position::text) = km.away_source;

DELETE FROM public.matches m
WHERE m.external_match_id LIKE 'ko:R16-%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.knockout_matches km
    WHERE km.round = 'R16'
      AND ('ko:' || km.round::text || '-' || km.position::text) = m.external_match_id
      AND km.home_team_id IS NOT NULL
      AND km.away_team_id IS NOT NULL
      AND km.home_team_id = m.home_team_id
      AND km.away_team_id = m.away_team_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.bets b WHERE b.match_id = m.id
  );

INSERT INTO public.matches (
  external_match_id, stage, home_team_id, away_team_id,
  kickoff, venue, home_score, away_score, finished
)
SELECT
  'ko:' || km.round::text || '-' || km.position::text,
  lower(km.round::text)::public.match_stage,
  km.home_team_id,
  km.away_team_id,
  COALESCE(km.kickoff, now() + interval '30 days'),
  km.venue,
  km.home_score,
  km.away_score,
  km.finished
FROM public.knockout_matches km
WHERE km.round = 'R16'
  AND km.home_team_id IS NOT NULL
  AND km.away_team_id IS NOT NULL
  AND km.home_team_id <> km.away_team_id
ON CONFLICT (external_match_id) DO UPDATE
  SET home_team_id = EXCLUDED.home_team_id,
      away_team_id = EXCLUDED.away_team_id,
      kickoff = EXCLUDED.kickoff,
      venue = EXCLUDED.venue,
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      finished = EXCLUDED.finished,
      stage = EXCLUDED.stage;