import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Team = { id: string; name: string; flag: string };
type Match = { id: string; home_team_id: string; away_team_id: string; kickoff: string };

export function FeaturedWelcomeBanner() {
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Record<string, Team>>({});

  useEffect(() => {
    (async () => {
      const [m, t] = await Promise.all([
        supabase
          .from("matches")
          .select("id,home_team_id,away_team_id,kickoff")
          .eq("featured", true)
          .eq("finished", false)
          .order("kickoff")
          .limit(1),
        supabase.from("teams").select("id,name,flag"),
      ]);
      if (t.data) setTeams(Object.fromEntries(t.data.map((x: any) => [x.id, x])));
      setMatch((m.data?.[0] as Match) ?? null);
    })();
  }, []);

  if (!match) return null;
  const home = teams[match.home_team_id];
  const away = teams[match.away_team_id];
  if (!home || !away) return null;
  const dia = new Date(match.kickoff).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const hora = new Date(match.kickoff).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full bg-yellow-400 text-emerald-950 px-3 py-2 text-center text-xs sm:text-sm font-semibold shadow-md border-b-2 border-yellow-500">
      👋 Bem-vindo! 🔥 <strong>{dia}</strong> tem <strong>{home.flag} {home.name} × {away.name} {away.flag}</strong> às <strong>{hora}</strong> — jogo em destaque! Entre e palpite no <u>Bolão Individual</u> (R$ 5). 🪙
    </div>
  );
}
