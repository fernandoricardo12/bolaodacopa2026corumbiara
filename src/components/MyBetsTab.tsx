import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trophy, CheckCircle2, XCircle, Clock, Coins, Target } from "lucide-react";
import { FlagImg } from "@/lib/flags";

type Team = { id: string; name: string; code: string };
type Match = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
  live_clock?: string | null;
  live_period?: number | null;
  live_status_detail?: string | null;
};
type Bet = { match_id: string; home_score: number; away_score: number; points: number };
type PointsPayment = { status: string };
type IBet = {
  id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  amount: number;
  paid: boolean;
  payout: number;
};

function feedbackPontos(pts: number) {
  if (pts === 20) return { label: "🎯 Placar exato!", tone: "bg-emerald-600 text-white" };
  if (pts === 15) return { label: "✅ Vencedor + 1 placar", tone: "bg-emerald-500 text-white" };
  if (pts === 10) return { label: "👍 Só vencedor", tone: "bg-yellow-500 text-white" };
  if (pts === 5)  return { label: "🤏 Só um placar", tone: "bg-orange-400 text-white" };
  return { label: "❌ Não pontuou", tone: "bg-slate-300 text-slate-700" };
}

function hasScore(m: Match): m is Match & { home_score: number; away_score: number } {
  return m.home_score !== null && m.away_score !== null;
}

function matchStatusLabel(m: Match) {
  if (m.finished) return "Encerrado";
  if (hasScore(m)) return m.live_status_detail || m.live_clock || "Ao vivo";
  return "Aguardando";
}

export function MyBetsTab({ userId }: { userId: string }) {
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [bets, setBets] = useState<Bet[]>([]);
  const [ibets, setIbets] = useState<IBet[]>([]);
  const [pointsPayments, setPointsPayments] = useState<PointsPayment[]>([]);

  async function load() {
    const [t, m, b, ib, pay] = await Promise.all([
      supabase.from("teams").select("id,name,code"),
      supabase.from("matches").select("id,home_team_id,away_team_id,kickoff,home_score,away_score,finished,live_clock,live_period,live_status_detail"),
      supabase.from("bets").select("match_id,home_score,away_score,points").eq("user_id", userId),
      supabase.from("individual_bets").select("*").eq("user_id", userId),
      supabase.from("payments").select("status").eq("user_id", userId).eq("mode", "points"),
    ]);
    if (t.data) setTeams(Object.fromEntries(t.data.map((x) => [x.id, x as Team])));
    if (m.data) setMatches(Object.fromEntries(m.data.map((x) => [x.id, x as Match])));
    if (b.data) setBets(b.data as Bet[]);
    if (ib.data) setIbets(ib.data as IBet[]);
    if (pay.data) setPointsPayments(pay.data as PointsPayment[]);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`mybets-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "individual_bets", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const totals = useMemo(() => {
    const pts = bets.reduce((s, b) => s + (b.points ?? 0), 0);
    const ganhoIndividual = ibets.reduce((s, b) => s + Number(b.payout ?? 0), 0);
    const acertos = bets.filter((b) => {
      const m = matches[b.match_id]; return !!m && hasScore(m) && (b.points ?? 0) > 0;
    }).length;
    const finalizados = bets.filter((b) => {
      const m = matches[b.match_id]; return !!m && hasScore(m);
    }).length;
    return { pts, ganhoIndividual, acertos, finalizados };
  }, [bets, ibets, matches]);

  const bolaoRows = useMemo(() => {
    return bets
      .map((b) => ({ b, m: matches[b.match_id] }))
      .filter((r) => r.m)
      .sort((a, b) => {
        // finalizados primeiro, depois por kickoff desc
        if (a.m!.finished !== b.m!.finished) return a.m!.finished ? -1 : 1;
        return new Date(b.m!.kickoff).getTime() - new Date(a.m!.kickoff).getTime();
      });
  }, [bets, matches]);

  const individualRows = useMemo(() => {
    return ibets
      .map((b) => ({ b, m: matches[b.match_id] }))
      .filter((r) => r.m)
      .sort((a, b) => {
        if (a.m!.finished !== b.m!.finished) return a.m!.finished ? -1 : 1;
        return new Date(b.m!.kickoff).getTime() - new Date(a.m!.kickoff).getTime();
      });
  }, [ibets, matches]);

  const pointsConfirmed = pointsPayments.some((p) => p.status === "confirmed");
  const pointsPending = pointsPayments.some((p) => p.status === "pending");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard icon={<Trophy className="h-4 w-4" />} label={pointsConfirmed ? "Seus pontos" : "Pontos fora do ranking"} value={totals.pts.toString()} tone="emerald" />
        <SummaryCard icon={<Target className="h-4 w-4" />} label="Acertos / jogos" value={`${totals.acertos}/${totals.finalizados}`} tone="yellow" />
        <SummaryCard icon={<Coins className="h-4 w-4" />} label="Ganho individual" value={`R$ ${totals.ganhoIndividual.toFixed(2)}`} tone="emerald" />
        <SummaryCard icon={<Clock className="h-4 w-4" />} label="Palpites individuais" value={ibets.length.toString()} tone="slate" />
      </div>

      {bets.length > 0 && !pointsConfirmed && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-3 flex gap-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <strong>{pointsPending ? "Pagamento do bolão em análise." : "Pagamento do bolão pendente."}</strong>{" "}
              {pointsPending
                ? "Esses pontos só aparecem no ranking depois da confirmação do administrador."
                : "Registre e envie o pagamento na aba Pagar para entrar no ranking oficial."}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Bolão de pontos — meus palpites
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {bolaoRows.length === 0 && <p className="p-6 text-sm text-center text-muted-foreground">Você ainda não fez palpites no bolão.</p>}
          {bolaoRows.map(({ b, m }) => {
            const home = teams[m!.home_team_id]; const away = teams[m!.away_team_id];
            if (!home || !away) return null;
            const scoreAvailable = hasScore(m!);
            const fb = scoreAvailable ? feedbackPontos(b.points ?? 0) : null;
            return (
              <div key={b.match_id} className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(m!.kickoff).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  <Badge variant={m!.finished ? "secondary" : scoreAvailable ? "default" : "outline"}>{matchStatusLabel(m!)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
                    <span className="text-sm font-medium truncate">{home.name}</span>
                    <FlagImg code={home.code} name={home.name} size={24} />
                  </div>
                  <div className="text-center shrink-0 px-2">
                    <div className="text-xs text-muted-foreground">Seu palpite</div>
                    <div className="text-lg font-bold tabular-nums">{b.home_score} × {b.away_score}</div>
                    {scoreAvailable && (
                      <>
                        <div className="text-xs text-muted-foreground mt-1">{m!.finished ? "Resultado" : "Ao vivo"}</div>
                        <div className="text-sm font-semibold tabular-nums">{m!.home_score} × {m!.away_score}</div>
                      </>
                    )}
                  </div>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <FlagImg code={away.code} name={away.name} size={24} />
                    <span className="text-sm font-medium truncate">{away.name}</span>
                  </div>
                </div>
                {fb && (
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${fb.tone}`}>{fb.label}</span>
                    <span className="text-sm font-bold">+{b.points ?? 0} pts{!m!.finished ? " parciais" : ""}</span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-600" /> Palpites individuais — feedback e prêmios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {individualRows.length === 0 && <p className="p-6 text-sm text-center text-muted-foreground">Nenhum palpite individual.</p>}
          {individualRows.map(({ b, m }) => {
            const home = teams[m!.home_team_id]; const away = teams[m!.away_team_id];
            if (!home || !away) return null;
            const acertouExato = m!.finished && b.home_score === m!.home_score && b.away_score === m!.away_score;
            const acertouVencedor = m!.finished && !acertouExato &&
              Math.sign(b.home_score - b.away_score) === Math.sign((m!.home_score ?? 0) - (m!.away_score ?? 0));
            return (
              <div key={b.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(m!.kickoff).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant={b.paid ? "secondary" : "outline"} className="text-[10px]">{b.paid ? "pago" : "não pago"}</Badge>
                    {m!.finished ? <Badge variant="secondary">Encerrado</Badge> : <Badge variant="outline">Aguardando</Badge>}
                  </div>
                </div>
                <div className="text-sm">
                  <strong>{home.name}</strong> {b.home_score} × {b.away_score} <strong>{away.name}</strong>
                  {m!.finished && (
                    <span className="text-muted-foreground"> (resultado: {m!.home_score}×{m!.away_score})</span>
                  )}
                </div>
                {m!.finished && (
                  <div className="flex items-center justify-between">
                    {acertouExato ? (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-600 text-white font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> 🎯 Placar exato!
                      </span>
                    ) : acertouVencedor ? (
                      <span className="text-xs px-2 py-1 rounded bg-yellow-500 text-white font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> ✅ Acertou vencedor
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-slate-300 text-slate-700 font-medium flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Não foi dessa vez
                      </span>
                    )}
                    <span className={`text-sm font-bold ${Number(b.payout) > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {Number(b.payout) > 0 ? `Ganhou R$ ${Number(b.payout).toFixed(2)}` : "R$ 0,00"}
                    </span>
                  </div>
                )}
                {!b.paid && !m!.finished && (
                  <p className="text-[11px] text-amber-600">⚠️ Confirme o pagamento na aba "Pagar" para concorrer ao prêmio.</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border-emerald-200",
    yellow: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 border-yellow-200",
    slate: "bg-slate-50 dark:bg-slate-900/50 text-slate-700 border-slate-200",
  };
  return (
    <Card className={`border ${tones[tone]}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[11px] font-medium opacity-80">{icon}{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
