import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Bet = { user_id: string; match_id: string; points: number };
type IBet = { user_id: string; match_id: string; paid: boolean; payout: number };
type Match = { id: string; finished: boolean };
type Profile = { id: string; display_name: string };

export function HighlightsSection() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [ibets, setIbets] = useState<IBet[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  async function load() {
    const [b, ib, m, pr] = await Promise.all([
      supabase.from("bets").select("user_id,match_id,points"),
      supabase.from("individual_bets").select("user_id,match_id,paid,payout"),
      supabase.from("matches").select("id,finished"),
      supabase.from("profiles").select("id,display_name"),
    ]);
    if (b.data) setBets(b.data as Bet[]);
    if (ib.data) setIbets(ib.data as IBet[]);
    if (m.data) setMatches(m.data as Match[]);
    if (pr.data) setProfiles(Object.fromEntries(pr.data.map((x: any) => [x.id, x])));
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("highlights-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "individual_bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const destaques = useMemo(() => {
    const finished = new Set(matches.filter((m) => m.finished).map((m) => m.id));
    const stats: Record<string, { name: string; pts: number; total: number; hits: number; exact: number; iwins: number; iCount: number }> = {};
    const ensure = (uid: string) => {
      stats[uid] ??= { name: profiles[uid]?.display_name ?? "Jogador", pts: 0, total: 0, hits: 0, exact: 0, iwins: 0, iCount: 0 };
      return stats[uid];
    };
    for (const b of bets) {
      if (!finished.has(b.match_id)) continue;
      const s = ensure(b.user_id);
      s.pts += b.points || 0;
      s.total += 1;
      if (b.points > 0) s.hits += 1;
      if (b.points === 20) s.exact += 1;
    }
    for (const ib of ibets) {
      if (!finished.has(ib.match_id) || !ib.paid) continue;
      const s = ensure(ib.user_id);
      s.iCount += 1;
      if (Number(ib.payout) > 0) s.iwins += 1;
    }
    const arr = Object.entries(stats).map(([uid, v]) => ({ uid, ...v, rate: v.total > 0 ? v.hits / v.total : 0 }));
    return {
      topPontos: [...arr].filter((x) => x.total > 0).sort((a, b) => b.pts - a.pts)[0],
      topIndividual: [...arr].filter((x) => x.iCount > 0).sort((a, b) => b.iwins - a.iwins || b.iCount - a.iCount)[0],
      sabeTudo: [...arr].filter((x) => x.exact > 0).sort((a, b) => b.exact - a.exact || b.pts - a.pts)[0],
      altoIndice: [...arr].filter((x) => x.total >= 3).sort((a, b) => b.rate - a.rate || b.pts - a.pts)[0],
      bolaMurcha: [...arr].filter((x) => x.total >= 3).sort((a, b) => a.pts - b.pts)[0],
    };
  }, [bets, ibets, matches, profiles]);

  const semDados = !destaques.topPontos && !destaques.topIndividual && !destaques.sabeTudo;

  return (
    <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-emerald-50 dark:from-yellow-950/20 dark:to-emerald-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          ⭐ Destaques da galera
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {semDados && (
          <p className="text-sm text-muted-foreground col-span-full">
            Os destaques aparecem aqui depois dos primeiros jogos terminarem. 🍿
          </p>
        )}
        <Highlight
          emoji="🥇" title="Mestre dos pontos" tone="amber"
          name={destaques.topPontos?.name}
          detail={destaques.topPontos ? `${destaques.topPontos.pts} pts em ${destaques.topPontos.total} palpites` : undefined}
        />
        <Highlight
          emoji="💰" title="Rei do individual" tone="emerald"
          name={destaques.topIndividual?.name}
          detail={destaques.topIndividual ? `${destaques.topIndividual.iwins} prêmio(s) em ${destaques.topIndividual.iCount} apostas` : undefined}
        />
        <Highlight
          emoji="🎯" title="Sabe-tudo (placar exato)" tone="violet"
          name={destaques.sabeTudo?.name}
          detail={destaques.sabeTudo ? `${destaques.sabeTudo.exact} placar(es) exato(s)` : undefined}
        />
        <Highlight
          emoji="🔥" title="Alto índice de acerto" tone="blue"
          name={destaques.altoIndice?.name}
          detail={destaques.altoIndice ? `${(destaques.altoIndice.rate * 100).toFixed(0)}% (${destaques.altoIndice.hits}/${destaques.altoIndice.total})` : undefined}
        />
        <Highlight
          emoji="🎈" title="Bola murcha da rodada" tone="slate"
          name={destaques.bolaMurcha?.name}
          detail={destaques.bolaMurcha ? `Só ${destaques.bolaMurcha.pts} pts em ${destaques.bolaMurcha.total} palpites` : undefined}
        />
      </CardContent>
    </Card>
  );
}

function Highlight({ emoji, title, name, detail, tone }: { emoji: string; title: string; name?: string; detail?: string; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30",
    blue: "border-blue-300 bg-blue-50/70 dark:bg-blue-950/30",
    amber: "border-amber-300 bg-amber-50/70 dark:bg-amber-950/30",
    violet: "border-violet-300 bg-violet-50/70 dark:bg-violet-950/30",
    slate: "border-slate-300 bg-slate-100/70 dark:bg-slate-800/50",
  };
  return (
    <div className={`rounded-lg border-2 p-3 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase opacity-80 flex items-center gap-1">
        <span className="text-base">{emoji}</span>{title}
      </div>
      <div className="text-base font-bold mt-1 truncate">{name ?? "—"}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{detail ?? "Sem dados ainda"}</div>
    </div>
  );
}
