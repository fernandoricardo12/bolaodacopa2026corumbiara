import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPointsRankingData, type PointsPaymentStatus } from "@/lib/pointsPayments.functions";

type Bet = { user_id: string; match_id: string; home_score?: number; away_score?: number; points: number };
type IBet = { user_id: string; match_id: string; paid: boolean; payout: number };
type Match = { id: string; kickoff?: string; home_score?: number | null; away_score?: number | null; finished: boolean; live_status_detail?: string | null };
type Profile = { id: string; display_name: string };

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function countsForRanking(m?: Match) {
  if (!m || m.home_score === null || m.home_score === undefined || m.away_score === null || m.away_score === undefined) return false;
  return true;
}

function calculateBolaoPoints(b: Bet, m?: Match) {
  if (!m || m.home_score === null || m.home_score === undefined || m.away_score === null || m.away_score === undefined) return 0;
  if (b.home_score === undefined || b.away_score === undefined) return b.points ?? 0;
  if (b.home_score === m.home_score && b.away_score === m.away_score) return 20;
  const winnerOk = Math.sign(b.home_score - b.away_score) === Math.sign(m.home_score - m.away_score);
  const oneScoreOk = b.home_score === m.home_score || b.away_score === m.away_score;
  if (winnerOk && oneScoreOk) return 15;
  if (winnerOk) return 10;
  if (oneScoreOk) return 5;
  return 0;
}

export function HighlightsSection() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [ibets, setIbets] = useState<IBet[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [payments, setPayments] = useState<PointsPaymentStatus[]>([]);
  const loadSeq = useRef(0);
  const fetchRanking = useServerFn(getPointsRankingData);

  async function load() {
    const seq = ++loadSeq.current;
    const [ranking, ib] = await Promise.all([
      fetchRanking(),
      fetchAllRows<IBet>((from, to) => supabase.from("individual_bets").select("user_id,match_id,paid,payout").range(from, to)),
    ]);
    if (seq !== loadSeq.current) return;
    setBets(ranking.bets as Bet[]);
    setIbets(ib);
    setMatches(ranking.matches as Match[]);
    setProfiles(Object.fromEntries(ranking.profiles.map((x: any) => [x.id, x])));
    setPayments(ranking.payments as PointsPaymentStatus[]);
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    const ch = supabase
      .channel("highlights-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "individual_bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .subscribe();
    return () => { window.clearInterval(interval); supabase.removeChannel(ch); };
  }, []);

  const destaques = useMemo(() => {
    const matchMap = Object.fromEntries(matches.map((m) => [m.id, m]));
    const validMatches = new Set(matches.filter(countsForRanking).map((m) => m.id));
    const paidUsers = new Set(payments.filter((p) => p.status === "confirmed").map((p) => p.user_id));
    const paymentMap = Object.fromEntries(payments.map((p) => [p.user_id, p]));
    const stats: Record<string, { name: string; pts: number; total: number; hits: number; exact: number; iwins: number; iCount: number }> = {};
    const ensure = (uid: string) => {
      stats[uid] ??= { name: profiles[uid]?.display_name ?? paymentMap[uid]?.display_name ?? "Jogador", pts: 0, total: 0, hits: 0, exact: 0, iwins: 0, iCount: 0 };
      return stats[uid];
    };
    for (const b of bets) {
      if (!validMatches.has(b.match_id)) continue;
      if (!paidUsers.has(b.user_id)) continue;
      const s = ensure(b.user_id);
      const points = calculateBolaoPoints(b, matchMap[b.match_id]);
      s.pts += points;
      s.total += 1;
      if (points > 0) s.hits += 1;
      if (points === 20) s.exact += 1;
    }
    for (const ib of ibets) {
      if (!validMatches.has(ib.match_id) || !ib.paid) continue;
      const s = ensure(ib.user_id);
      s.iCount += 1;
      if (Number(ib.payout) > 0) s.iwins += 1;
    }
    const arr = Object.entries(stats).map(([uid, v]) => ({ uid, ...v, rate: v.total > 0 ? v.hits / v.total : 0 }));
    const pickTied = <T extends { name: string }>(list: T[], keyFn: (x: T) => number | string) => {
      if (list.length === 0) return undefined;
      const sorted = [...list].sort((a, b) => {
        const ka = keyFn(a), kb = keyFn(b);
        if (ka !== kb) return ka < kb ? 1 : -1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
      const topKey = keyFn(sorted[0]);
      const tied = sorted.filter((x) => keyFn(x) === topKey);
      return { ...sorted[0], tiedWith: tied.slice(1).map((x) => x.name) } as T & { tiedWith: string[] };
    };
    const pickTiedAsc = <T extends { name: string }>(list: T[], keyFn: (x: T) => number) => {
      if (list.length === 0) return undefined;
      const sorted = [...list].sort((a, b) => {
        const ka = keyFn(a), kb = keyFn(b);
        if (ka !== kb) return ka - kb;
        return a.name.localeCompare(b.name, "pt-BR");
      });
      const topKey = keyFn(sorted[0]);
      const tied = sorted.filter((x) => keyFn(x) === topKey);
      return { ...sorted[0], tiedWith: tied.slice(1).map((x) => x.name) } as T & { tiedWith: string[] };
    };
    return {
      topPontos: pickTied(arr.filter((x) => x.total > 0), (x) => x.pts),
      topIndividual: pickTied(arr.filter((x) => x.iCount > 0), (x) => `${String(x.iwins).padStart(6, "0")}-${String(x.iCount).padStart(6, "0")}`),
      sabeTudo: pickTied(arr.filter((x) => x.exact > 0), (x) => `${String(x.exact).padStart(6, "0")}-${String(x.pts).padStart(8, "0")}`),
      altoIndice: pickTied(arr.filter((x) => x.total >= 3), (x) => `${x.rate.toFixed(6)}-${String(x.pts).padStart(8, "0")}`),
      bolaMurcha: pickTiedAsc(arr.filter((x) => x.total >= 3), (x) => x.pts),
    };
  }, [bets, ibets, matches, payments, profiles]);

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
          tiedWith={destaques.topPontos?.tiedWith}
        />
        <Highlight
          emoji="💰" title="Rei do individual" tone="emerald"
          name={destaques.topIndividual?.name}
          detail={destaques.topIndividual ? `${destaques.topIndividual.iwins} prêmio(s) em ${destaques.topIndividual.iCount} apostas` : undefined}
          tiedWith={destaques.topIndividual?.tiedWith}
        />
        <Highlight
          emoji="🎯" title="Sabe-tudo (placar exato)" tone="violet"
          name={destaques.sabeTudo?.name}
          detail={destaques.sabeTudo ? `${destaques.sabeTudo.exact} placar(es) exato(s)` : undefined}
          tiedWith={destaques.sabeTudo?.tiedWith}
        />
        <Highlight
          emoji="🔥" title="Alto índice de acerto" tone="blue"
          name={destaques.altoIndice?.name}
          detail={destaques.altoIndice ? `${(destaques.altoIndice.rate * 100).toFixed(0)}% (${destaques.altoIndice.hits}/${destaques.altoIndice.total})` : undefined}
          tiedWith={destaques.altoIndice?.tiedWith}
        />
        <Highlight
          emoji="🎈" title="Bola murcha da rodada" tone="slate"
          name={destaques.bolaMurcha?.name}
          detail={destaques.bolaMurcha ? `Só ${destaques.bolaMurcha.pts} pts em ${destaques.bolaMurcha.total} palpites` : undefined}
          tiedWith={destaques.bolaMurcha?.tiedWith}
        />
      </CardContent>
    </Card>
  );
}

function Highlight({ emoji, title, name, detail, tone, tiedWith }: { emoji: string; title: string; name?: string; detail?: string; tone: string; tiedWith?: string[] }) {
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
      {tiedWith && tiedWith.length > 0 && (
        <div className="text-[10px] text-muted-foreground mt-0.5 italic truncate">
          empatado com: {tiedWith.join(", ")}
        </div>
      )}
    </div>
  );
}
