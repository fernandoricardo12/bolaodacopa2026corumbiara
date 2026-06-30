
-- Permite avançar a chave mesmo quando o tempo regulamentar terminou empatado
-- (decisão na prorrogação/pênaltis). Mantemos home_score/away_score apenas com
-- os gols do tempo regulamentar para a pontuação do bolão.
ALTER TABLE public.knockout_matches
  ADD COLUMN IF NOT EXISTS winner_team_id uuid REFERENCES public.teams(id);

CREATE OR REPLACE FUNCTION public.advance_knockout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  winner uuid;
  loser uuid;
  win_code text;
  los_code text;
BEGIN
  IF NEW.finished = true
     AND NEW.home_team_id IS NOT NULL AND NEW.away_team_id IS NOT NULL THEN

    -- Preferimos winner_team_id (preenchido a partir do resultado real da ESPN,
    -- incluindo prorrogação e pênaltis). Se não houver, caímos no placar regular.
    IF NEW.winner_team_id IS NOT NULL THEN
      winner := NEW.winner_team_id;
      loser := CASE WHEN NEW.winner_team_id = NEW.home_team_id
                    THEN NEW.away_team_id ELSE NEW.home_team_id END;
    ELSIF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
      IF NEW.home_score > NEW.away_score THEN
        winner := NEW.home_team_id; loser := NEW.away_team_id;
      ELSIF NEW.away_score > NEW.home_score THEN
        winner := NEW.away_team_id; loser := NEW.home_team_id;
      ELSE
        RETURN NEW; -- empate sem vencedor definido: não avança
      END IF;
    ELSE
      RETURN NEW;
    END IF;

    win_code := 'W:' || NEW.round || '-' || NEW.position;
    los_code := 'L:' || NEW.round || '-' || NEW.position;

    UPDATE public.knockout_matches SET home_team_id = winner
      WHERE home_team_id IS NULL AND home_source = win_code;
    UPDATE public.knockout_matches SET away_team_id = winner
      WHERE away_team_id IS NULL AND away_source = win_code;
    UPDATE public.knockout_matches SET home_team_id = loser
      WHERE home_team_id IS NULL AND home_source = los_code;
    UPDATE public.knockout_matches SET away_team_id = loser
      WHERE away_team_id IS NULL AND away_source = los_code;
  END IF;
  RETURN NEW;
END $function$;

-- Garante que o trigger esteja ativo (caso tenha sido removido em migração anterior)
DROP TRIGGER IF EXISTS knockout_advance_trigger ON public.knockout_matches;
CREATE TRIGGER knockout_advance_trigger
  AFTER INSERT OR UPDATE ON public.knockout_matches
  FOR EACH ROW EXECUTE FUNCTION public.advance_knockout();
