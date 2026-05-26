
CREATE OR REPLACE FUNCTION public.calc_points(b_home integer, b_away integer, r_home integer, r_away integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE exact_score boolean; winner_ok boolean; one_score_ok boolean;
BEGIN
  IF r_home IS NULL OR r_away IS NULL THEN RETURN 0; END IF;
  exact_score := (b_home = r_home AND b_away = r_away);
  IF exact_score THEN RETURN 20; END IF;
  winner_ok := sign(b_home - b_away) = sign(r_home - r_away);
  one_score_ok := (b_home = r_home) OR (b_away = r_away);
  IF winner_ok AND one_score_ok THEN RETURN 15; END IF;
  IF winner_ok THEN RETURN 10; END IF;
  IF one_score_ok THEN RETURN 5; END IF;
  RETURN 0;
END $$;

DO $$ BEGIN CREATE TYPE public.bet_mode AS ENUM ('points','individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mode public.bet_mode NOT NULL DEFAULT 'points',
  ADD COLUMN IF NOT EXISTS match_id uuid;

CREATE TABLE IF NOT EXISTS public.individual_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  match_id uuid NOT NULL,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  amount numeric NOT NULL DEFAULT 10,
  paid boolean NOT NULL DEFAULT false,
  payout numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.individual_bets TO authenticated;
GRANT ALL ON public.individual_bets TO service_role;
ALTER TABLE public.individual_bets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Individual bets readable" ON public.individual_bets FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert own individual bets" ON public.individual_bets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own pre-kickoff ind" ON public.individual_bets FOR UPDATE TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.finished = false AND m.kickoff > now()))
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins update individual bets" ON public.individual_bets FOR UPDATE TO authenticated
    USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete own pre-kickoff ind" ON public.individual_bets FOR DELETE TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.finished = false AND m.kickoff > now()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS touch_individual_bets ON public.individual_bets;
CREATE TRIGGER touch_individual_bets BEFORE UPDATE ON public.individual_bets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$ BEGIN CREATE TYPE public.ko_round AS ENUM ('R32','R16','QF','SF','THIRD','FINAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.knockout_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round public.ko_round NOT NULL,
  position integer NOT NULL,
  label text NOT NULL,
  home_team_id uuid,
  away_team_id uuid,
  home_source text,
  away_source text,
  home_score integer,
  away_score integer,
  kickoff timestamptz,
  venue text,
  finished boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round, position)
);
GRANT SELECT ON public.knockout_matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knockout_matches TO authenticated;
GRANT ALL ON public.knockout_matches TO service_role;
ALTER TABLE public.knockout_matches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Knockout readable" ON public.knockout_matches FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage knockout" ON public.knockout_matches FOR ALL TO authenticated
    USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS touch_knockout ON public.knockout_matches;
CREATE TRIGGER touch_knockout BEFORE UPDATE ON public.knockout_matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.recalculate_individual_payouts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE total_pool numeric; net numeric; exact_pool numeric; winner_pool numeric;
        exact_count integer; winner_count integer; exact_share numeric; winner_share numeric;
BEGIN
  IF NEW.finished = true AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    SELECT COALESCE(SUM(amount),0) INTO total_pool FROM public.individual_bets WHERE match_id = NEW.id AND paid = true;
    net := total_pool * 0.80;
    exact_pool := net * (80.0/140.0);
    winner_pool := net * (60.0/140.0);
    SELECT COUNT(*) INTO exact_count FROM public.individual_bets
      WHERE match_id = NEW.id AND paid = true AND home_score = NEW.home_score AND away_score = NEW.away_score;
    SELECT COUNT(*) INTO winner_count FROM public.individual_bets
      WHERE match_id = NEW.id AND paid = true
      AND NOT (home_score = NEW.home_score AND away_score = NEW.away_score)
      AND sign(home_score - away_score) = sign(NEW.home_score - NEW.away_score);
    exact_share := CASE WHEN exact_count > 0 THEN exact_pool / exact_count ELSE 0 END;
    winner_share := CASE WHEN winner_count > 0 THEN winner_pool / winner_count ELSE 0 END;
    UPDATE public.individual_bets SET payout = 0 WHERE match_id = NEW.id;
    UPDATE public.individual_bets SET payout = exact_share
      WHERE match_id = NEW.id AND paid = true AND home_score = NEW.home_score AND away_score = NEW.away_score;
    UPDATE public.individual_bets SET payout = winner_share
      WHERE match_id = NEW.id AND paid = true
      AND NOT (home_score = NEW.home_score AND away_score = NEW.away_score)
      AND sign(home_score - away_score) = sign(NEW.home_score - NEW.away_score);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_bets ON public.matches;
CREATE TRIGGER trg_recalc_bets AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_bets_for_match();

DROP TRIGGER IF EXISTS trg_recalc_payouts ON public.matches;
CREATE TRIGGER trg_recalc_payouts AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_individual_payouts();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.individual_bets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.knockout_matches;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.bets REPLICA IDENTITY FULL;
ALTER TABLE public.individual_bets REPLICA IDENTITY FULL;
ALTER TABLE public.knockout_matches REPLICA IDENTITY FULL;
