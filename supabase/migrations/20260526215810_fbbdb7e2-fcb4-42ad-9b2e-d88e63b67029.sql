
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.match_stage AS ENUM ('group', 'r32', 'r16', 'qf', 'sf', 'third', 'final');
CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'rejected');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  flag TEXT NOT NULL,
  group_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO authenticated, anon;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams readable" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins manage teams" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id UUID NOT NULL REFERENCES public.teams(id),
  away_team_id UUID NOT NULL REFERENCES public.teams(id),
  kickoff TIMESTAMPTZ NOT NULL,
  stage match_stage NOT NULL DEFAULT 'group',
  group_name TEXT,
  venue TEXT,
  home_score INTEGER,
  away_score INTEGER,
  finished BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (home_team_id <> away_team_id)
);
CREATE INDEX matches_kickoff_idx ON public.matches(kickoff);
GRANT SELECT ON public.matches TO authenticated, anon;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches readable" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins manage matches" ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL CHECK (home_score >= 0),
  away_score INTEGER NOT NULL CHECK (away_score >= 0),
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
CREATE INDEX bets_user_idx ON public.bets(user_id);
CREATE INDEX bets_match_idx ON public.bets(match_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bets readable" ON public.bets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own bets" ON public.bets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bets pre-kickoff" ON public.bets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.finished = false AND m.kickoff > now()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bets" ON public.bets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  proof_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own payments or admin" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own payment" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_matches BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_bets BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.calc_points(b_home INT, b_away INT, r_home INT, r_away INT)
RETURNS INT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF r_home IS NULL OR r_away IS NULL THEN RETURN 0; END IF;
  IF b_home = r_home AND b_away = r_away THEN RETURN 10; END IF;
  IF (b_home - b_away) = (r_home - r_away) AND sign(b_home - b_away) = sign(r_home - r_away) THEN RETURN 5; END IF;
  IF sign(b_home - b_away) = sign(r_home - r_away) THEN RETURN 3; END IF;
  RETURN 0;
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_bets_for_match() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.finished = true AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.bets SET points = public.calc_points(home_score, away_score, NEW.home_score, NEW.away_score)
    WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER recalc_bets AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.recalculate_bets_for_match();

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

INSERT INTO public.teams (name, code, flag, group_name) VALUES
('Canadá','CAN','🇨🇦','A'),('México','MEX','🇲🇽','A'),('Estados Unidos','USA','🇺🇸','A'),('Marrocos','MAR','🇲🇦','A'),
('Argentina','ARG','🇦🇷','B'),('Equador','ECU','🇪🇨','B'),('Egito','EGY','🇪🇬','B'),('Coreia do Sul','KOR','🇰🇷','B'),
('Brasil','BRA','🇧🇷','C'),('Paraguai','PAR','🇵🇾','C'),('Costa do Marfim','CIV','🇨🇮','C'),('Japão','JPN','🇯🇵','C'),
('França','FRA','🇫🇷','D'),('Suíça','SUI','🇨🇭','D'),('Senegal','SEN','🇸🇳','D'),('Austrália','AUS','🇦🇺','D'),
('Inglaterra','ENG','🏴󠁧󠁢󠁥󠁮󠁧󠁿','E'),('Áustria','AUT','🇦🇹','E'),('Tunísia','TUN','🇹🇳','E'),('Irã','IRN','🇮🇷','E'),
('Espanha','ESP','🇪🇸','F'),('Croácia','CRO','🇭🇷','F'),('Argélia','ALG','🇩🇿','F'),('Arábia Saudita','KSA','🇸🇦','F'),
('Alemanha','GER','🇩🇪','G'),('Dinamarca','DEN','🇩🇰','G'),('Gana','GHA','🇬🇭','G'),('Uzbequistão','UZB','🇺🇿','G'),
('Portugal','POR','🇵🇹','H'),('Noruega','NOR','🇳🇴','H'),('África do Sul','RSA','🇿🇦','H'),('Catar','QAT','🇶🇦','H'),
('Holanda','NED','🇳🇱','I'),('Escócia','SCO','🏴󠁧󠁢󠁳󠁣󠁴󠁿','I'),('Nigéria','NGA','🇳🇬','I'),('Nova Zelândia','NZL','🇳🇿','I'),
('Itália','ITA','🇮🇹','J'),('Polônia','POL','🇵🇱','J'),('Costa Rica','CRC','🇨🇷','J'),('Iraque','IRQ','🇮🇶','J'),
('Bélgica','BEL','🇧🇪','K'),('País de Gales','WAL','🏴󠁧󠁢󠁷󠁬󠁳󠁿','K'),('Panamá','PAN','🇵🇦','K'),('Jamaica','JAM','🇯🇲','K'),
('Uruguai','URU','🇺🇾','L'),('Colômbia','COL','🇨🇴','L'),('Jordânia','JOR','🇯🇴','L'),('Cabo Verde','CPV','🇨🇻','L');

INSERT INTO public.matches (home_team_id, away_team_id, kickoff, stage, group_name, venue)
SELECT h.id, a.id, v.ts::timestamptz, 'group'::match_stage, v.grp, v.vn FROM (
  VALUES
    ('México','Marrocos','2026-06-11 21:00:00+00','A','Estádio Azteca, Cidade do México'),
    ('Canadá','Estados Unidos','2026-06-12 20:00:00+00','A','BMO Field, Toronto'),
    ('Argentina','Coreia do Sul','2026-06-13 19:00:00+00','B','MetLife Stadium, NJ'),
    ('Brasil','Japão','2026-06-14 22:00:00+00','C','SoFi Stadium, LA'),
    ('França','Senegal','2026-06-15 19:00:00+00','D','AT&T Stadium, Dallas'),
    ('Inglaterra','Irã','2026-06-16 20:00:00+00','E','Lincoln Financial, Filadélfia'),
    ('Espanha','Arábia Saudita','2026-06-17 21:00:00+00','F','Levi''s Stadium, SF'),
    ('Alemanha','Gana','2026-06-18 18:00:00+00','G','Arrowhead, Kansas City'),
    ('Portugal','Catar','2026-06-19 22:00:00+00','H','Hard Rock, Miami'),
    ('Holanda','Nigéria','2026-06-20 20:00:00+00','I','NRG Stadium, Houston'),
    ('Itália','Costa Rica','2026-06-21 19:00:00+00','J','Mercedes-Benz, Atlanta'),
    ('Bélgica','Panamá','2026-06-22 21:00:00+00','K','Gillette, Boston')
  ) AS v(home, away, ts, grp, vn)
  JOIN public.teams h ON h.name = v.home
  JOIN public.teams a ON a.name = v.away;
