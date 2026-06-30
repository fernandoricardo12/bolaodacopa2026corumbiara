
-- Alemanha 1 x 1 Paraguai (Paraguai venceu nos pênaltis)
UPDATE public.knockout_matches
SET finished = true,
    home_score = 1,
    away_score = 1,
    winner_team_id = (SELECT id FROM public.teams WHERE code = 'PAR')
WHERE round = 'R32' AND position = 3;

-- Holanda 1 x 1 Marrocos (Marrocos venceu nos pênaltis)
UPDATE public.knockout_matches
SET finished = true,
    home_score = 1,
    away_score = 1,
    winner_team_id = (SELECT id FROM public.teams WHERE code = 'MAR')
WHERE round = 'R32' AND position = 4;

-- Espelha em matches (mantém apenas placar regulamentar)
UPDATE public.matches
SET finished = true, home_score = 1, away_score = 1
WHERE external_match_id IN ('ko:R32-3', 'ko:R32-4');
