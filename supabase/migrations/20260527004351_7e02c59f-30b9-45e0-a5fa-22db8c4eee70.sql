
-- ============ Auto-advance knockout ============
CREATE OR REPLACE FUNCTION public.advance_knockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  winner uuid;
  loser uuid;
  win_code text;
  los_code text;
BEGIN
  IF NEW.finished = true AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
     AND NEW.home_team_id IS NOT NULL AND NEW.away_team_id IS NOT NULL THEN

    IF NEW.home_score > NEW.away_score THEN
      winner := NEW.home_team_id; loser := NEW.away_team_id;
    ELSIF NEW.away_score > NEW.home_score THEN
      winner := NEW.away_team_id; loser := NEW.home_team_id;
    ELSE
      -- empate sem definição: não avança
      RETURN NEW;
    END IF;

    win_code := 'W:' || NEW.round || '-' || NEW.position;
    los_code := 'L:' || NEW.round || '-' || NEW.position;

    -- preenche slots dependentes
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
END $$;

DROP TRIGGER IF EXISTS knockout_advance_trg ON public.knockout_matches;
CREATE TRIGGER knockout_advance_trg
AFTER UPDATE ON public.knockout_matches
FOR EACH ROW EXECUTE FUNCTION public.advance_knockout();

-- ============ Delete participant (admin) ============
CREATE OR REPLACE FUNCTION public.admin_delete_participant(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir participantes';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir a si mesmo';
  END IF;
  DELETE FROM public.bets WHERE user_id = _user_id;
  DELETE FROM public.individual_bets WHERE user_id = _user_id;
  DELETE FROM public.payments WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_delete_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_participant(uuid) TO authenticated;
