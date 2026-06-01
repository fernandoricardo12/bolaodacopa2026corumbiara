
CREATE OR REPLACE FUNCTION public.rollover_friendly_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bra_id uuid;
  exact_count integer;
  next_match uuid;
BEGIN
  IF NEW.finished = true
     AND (OLD.finished IS DISTINCT FROM true)
     AND COALESCE(NEW.bonus_prize, 0) > 0
     AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN

    SELECT id INTO bra_id FROM public.teams WHERE upper(code) = 'BRA' LIMIT 1;
    IF bra_id IS NULL THEN RETURN NEW; END IF;

    IF NEW.home_team_id <> bra_id AND NEW.away_team_id <> bra_id THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO exact_count
    FROM public.individual_bets
    WHERE match_id = NEW.id AND paid = true
      AND home_score = NEW.home_score AND away_score = NEW.away_score;

    IF exact_count > 0 THEN RETURN NEW; END IF;

    -- Próximo jogo da Seleção (amistoso OU Copa)
    SELECT id INTO next_match
    FROM public.matches
    WHERE finished = false
      AND kickoff > NEW.kickoff
      AND (home_team_id = bra_id OR away_team_id = bra_id)
      AND id <> NEW.id
    ORDER BY kickoff ASC
    LIMIT 1;

    IF next_match IS NOT NULL THEN
      UPDATE public.matches
        SET bonus_prize = COALESCE(bonus_prize, 0) + NEW.bonus_prize
        WHERE id = next_match;
      UPDATE public.matches SET bonus_prize = 0 WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
