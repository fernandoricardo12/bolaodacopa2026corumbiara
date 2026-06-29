-- Fix knockout bracket per official FIFA 2026 schedule
-- R16 pairings (positions 1..8) following FIFA bracket
UPDATE public.knockout_matches SET home_source='W:R32-3', away_source='W:R32-6', kickoff='2026-07-04T21:00:00Z', venue='Philadelphia', label='Jogo 89' WHERE round='R16' AND position=1;
UPDATE public.knockout_matches SET home_source='W:R32-1', away_source='W:R32-4', kickoff='2026-07-04T17:00:00Z', venue='Houston', label='Jogo 90' WHERE round='R16' AND position=2;
UPDATE public.knockout_matches SET home_source='W:R32-2', away_source='W:R32-5', kickoff='2026-07-05T20:00:00Z', venue='East Rutherford', label='Jogo 91' WHERE round='R16' AND position=3;
UPDATE public.knockout_matches SET home_source='W:R32-7', away_source='W:R32-8', kickoff='2026-07-06T00:00:00Z', venue='Cidade do México', label='Jogo 92' WHERE round='R16' AND position=4;
UPDATE public.knockout_matches SET home_source='W:R32-12', away_source='W:R32-11', kickoff='2026-07-06T19:00:00Z', venue='Arlington', label='Jogo 93' WHERE round='R16' AND position=5;
UPDATE public.knockout_matches SET home_source='W:R32-10', away_source='W:R32-9', kickoff='2026-07-07T00:00:00Z', venue='Seattle', label='Jogo 94' WHERE round='R16' AND position=6;
UPDATE public.knockout_matches SET home_source='W:R32-15', away_source='W:R32-14', kickoff='2026-07-07T16:00:00Z', venue='Atlanta', label='Jogo 95' WHERE round='R16' AND position=7;
UPDATE public.knockout_matches SET home_source='W:R32-13', away_source='W:R32-16', kickoff='2026-07-07T20:00:00Z', venue='Vancouver', label='Jogo 96' WHERE round='R16' AND position=8;

-- QF pairings per FIFA
UPDATE public.knockout_matches SET home_source='W:R16-1', away_source='W:R16-2', label='Jogo 97', kickoff='2026-07-09T20:00:00Z', venue='Foxborough' WHERE round='QF' AND position=1;
UPDATE public.knockout_matches SET home_source='W:R16-5', away_source='W:R16-6', label='Jogo 98', kickoff='2026-07-10T19:00:00Z', venue='Inglewood' WHERE round='QF' AND position=2;
UPDATE public.knockout_matches SET home_source='W:R16-3', away_source='W:R16-4', label='Jogo 99', kickoff='2026-07-11T21:00:00Z', venue='Miami Gardens' WHERE round='QF' AND position=3;
UPDATE public.knockout_matches SET home_source='W:R16-7', away_source='W:R16-8', label='Jogo 100', kickoff='2026-07-12T01:00:00Z', venue='Kansas City' WHERE round='QF' AND position=4;

-- Clear pre-resolved teams in R16/QF/SF/Final so they re-fill from real R32 winners
UPDATE public.knockout_matches SET home_team_id=NULL, away_team_id=NULL, home_score=NULL, away_score=NULL, finished=false
 WHERE round IN ('R16','QF','SF','THIRD','FINAL');

-- Now resolve home/away from R32 winners we already have
WITH winners AS (
  SELECT position,
    CASE WHEN finished AND home_score IS NOT NULL AND away_score IS NOT NULL THEN
      CASE WHEN home_score > away_score THEN home_team_id
           WHEN away_score > home_score THEN away_team_id
           ELSE NULL END
    END AS winner_id
  FROM public.knockout_matches WHERE round='R32'
)
UPDATE public.knockout_matches km SET
  home_team_id = COALESCE(km.home_team_id, (SELECT w.winner_id FROM winners w WHERE 'W:R32-'||w.position = km.home_source)),
  away_team_id = COALESCE(km.away_team_id, (SELECT w.winner_id FROM winners w WHERE 'W:R32-'||w.position = km.away_source))
WHERE km.round='R16';