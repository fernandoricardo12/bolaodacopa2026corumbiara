import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Sparkles, Clock } from "lucide-react";

type Team = { id: string; name: string; flag: string; code: string };
type Match = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  featured: boolean;
  bonus_prize: number | null;
  finished: boolean;
};

function fmtKickoff(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function countdown(iso: string, now: Date) {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff <= 0) return "ao vivo / encerrando";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `em ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `em ${h}h ${m}min`;
  return `em ${m}min`;
}

export function FeaturedMatchCard({
  onGoIndividual,
  ctaLabel,
  variant = "logged",
}: {
  onGoIndividual: () => void;
  ctaLabel?: string;
  variant?: "logged" | "public";
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [now, setNow] = useState(() => new Date());

  async function load() {
    const [m, t] = await Promise.all([
      supabase
        .from("matches")
        .select("id,home_team_id,away_team_id,kickoff,featured,bonus_prize,finished")
        .eq("featured", true)
        .eq("finished", false)
        .order("kickoff")
        .limit(1),
      supabase.from("teams").select("id,name,flag,code"),
    ]);
    if (t.data) setTeams(Object.fromEntries(t.data.map((x: any) => [x.id, x])));
    setMatch((m.data?.[0] as Match) ?? null);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("featured-card-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, []);

  if (!match) return null;
  const home = teams[match.home_team_id];
  const away = teams[match.away_team_id];
  if (!home || !away) return null;
  const bonus = Number(match.bonus_prize ?? 0);
  const closed = new Date(match.kickoff).getTime() - now.getTime() <= 10 * 60_000;

  return (
    <Card className="mb-4 border-2 border-yellow-400 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white shadow-xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge className="bg-yellow-400 text-emerald-950 hover:bg-yellow-400 font-bold">
            <Sparkles className="h-3 w-3 mr-1" /> JOGO EM DESTAQUE
          </Badge>
          <div className="flex items-center gap-1 text-xs text-yellow-100">
            <Clock className="h-3 w-3" /> {fmtKickoff(match.kickoff)} · {countdown(match.kickoff, now)}
          </div>
        </div>

        <div className="text-center py-2">
          <div className="text-xl sm:text-2xl font-extrabold drop-shadow">
            {home.flag} {home.name} <span className="text-yellow-300">×</span> {away.name} {away.flag}
          </div>
        </div>

        <div className="rounded-lg bg-emerald-950/40 border border-yellow-400/40 p-3 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-yellow-300">
            <Coins className="h-4 w-4" /> Bolão Individual liberado!
          </div>
          <ul className="text-xs sm:text-sm text-emerald-50 space-y-1 pl-1">
            <li>🪙 Aposte <strong>R$ 5</strong> no placar exato</li>
            <li>🏆 <strong>80%</strong> do bolo p/ quem cravar o placar exato (dividido em caso de empate)</li>
            <li className="text-yellow-100/90">🔄 Se ninguém cravar, os 80% acumulam para o próximo jogo em destaque.</li>
            {bonus > 0 && (
              <li className="text-yellow-200">
                🎁 <strong>Bônus extra de R$ {bonus.toFixed(2).replace(".", ",")}</strong> dividido entre quem cravar o placar exato
              </li>
            )}
            <li className="text-yellow-100/90">⚖️ Havendo mais de um ganhador, a premiação é sempre dividida.</li>
          </ul>
        </div>

        <Button
          size="lg"
          onClick={onGoIndividual}
          disabled={variant === "logged" && closed}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-bold shadow"
        >
          {ctaLabel ?? (closed ? "Palpites encerrados" : "🪙 Palpitar agora no Individual")}
        </Button>
        <p className="text-[11px] text-center text-yellow-100/80">
          Palpites fecham 10 minutos antes do início.
        </p>
      </CardContent>
    </Card>
  );
}
