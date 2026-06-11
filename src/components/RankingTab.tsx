import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trophy, Medal, ChevronDown, ChevronRight } from "lucide-react";
import podium from "@/assets/podium.jpg";
import { HighlightsSection } from "@/components/HighlightsSection";
import { getPointsRankingData, type PointsPaymentStatus } from "@/lib/pointsPayments.functions";

type Bet = { user_id: string; match_id: string; home_score: number; away_score: number; points: number };
type Match = { id: string; kickoff: string; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; finished: boolean; live_status_detail: string | null };
type Team = { id: string; name: string; code: string };
type Profile = { id: string; display_name: string; avatar_url: string | null };

type Row = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  bets: number;
  paid: boolean;
};

function countsForRanking(m?: Match) {
  if (!m || m.home_score === null || m.away_score === null) return false;
  if (m.finished) return true;
  if (new Date(m.kickoff).getTime() > Date.now()) return false;
  const status = (m.live_status_detail ?? "").trim().toLowerCase();
  return !["scheduled", "not started", "pre-game", "pre game"].includes(status);
}

function matchStarted(m?: Match) {
  if (!m) return false;
  if (m.finished) return true;
  if (m.home_score !== null && m.away_score !== null) return true;
  return new Date(m.kickoff).getTime() <= Date.now();
}

export function RankingTab({ currentUserId }: { currentUserId: string }) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [payments, setPayments] = useState<PointsPaymentStatus[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fetchRanking = useServerFn(getPointsRankingData);

  async function load() {
    const data = await fetchRanking();
    setBets(data.bets as Bet[]);
    setMatches(Object.fromEntries((data.matches as Match[]).map((x) => [x.id, x])));
    setTeams(Object.fromEntries((data.teams as Team[]).map((x) => [x.id, x])));
    setProfiles(Object.fromEntries((data.profiles as Profile[]).map((x) => [x.id, x])));
    setPayments(data.payments as PointsPaymentStatus[]);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ranking-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const { rows, currentUserHasBets, currentUserPaymentStatus } = useMemo(() => {
    const paidUsers = new Set(payments.filter((p) => p.status === "confirmed").map((p) => p.user_id));
    const pendingUsers = new Set(
      payments.filter((p) => p.status === "pending" && !paidUsers.has(p.user_id)).map((p) => p.user_id)
    );
    const agg: Record<string, { points: number; bets: number }> = {};
    for (const uid of [...paidUsers, ...pendingUsers]) {
      agg[uid] ??= { points: 0, bets: 0 };
    }
    for (const b of bets) {
      agg[b.user_id] ??= { points: 0, bets: 0 };
      agg[b.user_id].points += countsForRanking(matches[b.match_id]) ? b.points || 0 : 0;
      agg[b.user_id].bets += 1;
    }
    const paymentByUser = Object.fromEntries(payments.map((p) => [p.user_id, p]));
    const arr: Row[] = Object.entries(agg)
      .filter(([uid]) => paidUsers.has(uid) || pendingUsers.has(uid))
      .map(([uid, v]) => ({
        user_id: uid,
        display_name: profiles[uid]?.display_name ?? paymentByUser[uid]?.display_name ?? "Jogador",
        avatar_url: profiles[uid]?.avatar_url ?? paymentByUser[uid]?.avatar_url ?? null,
        points: v.points,
        bets: v.bets,
        paid: paidUsers.has(uid),
      }));
    arr.sort((a, b) => Number(b.paid) - Number(a.paid) || b.points - a.points || b.bets - a.bets || a.display_name.localeCompare(b.display_name, "pt-BR"));
    const hasBets = bets.some((b) => b.user_id === currentUserId);
    const status: "confirmed" | "pending" | "none" = paidUsers.has(currentUserId)
      ? "confirmed"
      : pendingUsers.has(currentUserId)
        ? "pending"
        : "none";
    return { rows: arr, currentUserHasBets: hasBets, currentUserPaymentStatus: status };
  }, [bets, matches, profiles, payments, currentUserId]);


  const betsByUser = useMemo(() => {
    const map: Record<string, Bet[]> = {};
    for (const b of bets) {
      if (!matchStarted(matches[b.match_id])) continue; // só revela após início
      (map[b.user_id] ??= []).push(b);
    }
    for (const uid of Object.keys(map)) {
      map[uid].sort((a, b) => {
        const ka = new Date(matches[a.match_id]?.kickoff ?? 0).getTime();
        const kb = new Date(matches[b.match_id]?.kickoff ?? 0).getTime();
        return kb - ka;
      });
    }
    return map;
  }, [bets, matches]);

  const toggle = (uid: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });

  const medal = (i: number) =>
    i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-700" : "text-muted-foreground";

  const paidRows = rows.filter((r) => r.paid);
  const pendingRows = rows.filter((r) => !r.paid);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border-2 border-yellow-400 shadow">
        <img src={podium} alt="Pódio dos campeões" className="w-full h-28 sm:h-36 object-cover" loading="lazy" width={1280} height={640} />
      </div>
      <HighlightsSection />
      {currentUserHasBets && currentUserPaymentStatus !== "confirmed" && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-3 flex gap-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <strong>{currentUserPaymentStatus === "pending" ? "Seu pagamento está em análise." : "Você ainda não está no ranking."}</strong>{" "}
              {currentUserPaymentStatus === "pending"
                ? "Seus pontos entram aqui assim que o administrador confirmar o pagamento do bolão."
                : "Registre o pagamento do bolão de pontos na aba Pagar para seus palpites entrarem no ranking."}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
            🏆 Ranking oficial ({paidRows.length})
          </div>
          <div className="divide-y">
            {paidRows.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Sem jogadores confirmados ainda.</p>}
            {paidRows.map((r, i) => (
              <RowItem
                key={r.user_id}
                r={r}
                rank={i + 1}
                isMe={r.user_id === currentUserId}
                medalClass={medal(i)}
                open={expanded.has(r.user_id)}
                onToggle={() => toggle(r.user_id)}
                bets={betsByUser[r.user_id] ?? []}
                matches={matches}
                teams={teams}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {pendingRows.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="p-0">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
              ⏳ Aguardando pagamento ({pendingRows.length}) — não contam no ranking
            </div>
            <div className="divide-y opacity-80">
              {pendingRows.map((r) => (
                <RowItem
                  key={r.user_id}
                  r={r}
                  rank={null}
                  isMe={r.user_id === currentUserId}
                  medalClass="text-muted-foreground"
                  open={expanded.has(r.user_id)}
                  onToggle={() => toggle(r.user_id)}
                  bets={betsByUser[r.user_id] ?? []}
                  matches={matches}
                  teams={teams}
                  pending
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RowItem({
  r, rank, isMe, medalClass, open, onToggle, bets, matches, teams, pending,
}: {
  r: Row; rank: number | null; isMe: boolean; medalClass: string; open: boolean; onToggle: () => void;
  bets: Bet[]; matches: Record<string, Match>; teams: Record<string, Team>; pending?: boolean;
}) {
  const hasVisibleBets = bets.length > 0;
  return (
    <div className={isMe ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40"
      >
        <div className="w-7 flex items-center justify-center">
          {rank !== null && rank <= 3 ? <Medal className={`h-5 w-5 ${medalClass}`} /> : <span className="text-sm font-medium text-muted-foreground">{rank ?? "—"}</span>}
        </div>
        <Avatar className="h-9 w-9">
          <AvatarImage src={r.avatar_url ?? undefined} />
          <AvatarFallback>{r.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="truncate">{r.display_name}</span>
            {pending && <Badge variant="outline" className="text-[10px]">pendente</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">{r.bets} palpites</div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 font-bold text-lg">
            <Trophy className="h-4 w-4 text-amber-500" /> {r.points}
          </div>
          <div className="text-[10px] text-muted-foreground">pts</div>
        </div>
        {hasVisibleBets ? (open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />) : <span className="w-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {!hasVisibleBets ? (
            <p className="text-xs text-muted-foreground italic">Palpites ficam visíveis quando os jogos começam.</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {bets.map((b) => {
                const m = matches[b.match_id];
                const home = m ? teams[m.home_team_id]?.code ?? "—" : "—";
                const away = m ? teams[m.away_team_id]?.code ?? "—" : "—";
                const hasResult = m && m.home_score !== null && m.away_score !== null;
                const exact = hasResult && b.home_score === m!.home_score && b.away_score === m!.away_score;
                return (
                  <div key={`${b.user_id}-${b.match_id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium">{home} × {away}</span>
                      {hasResult && (
                        <span className="text-muted-foreground">
                          (oficial: {m!.home_score}×{m!.away_score})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{b.home_score} × {b.away_score}</span>
                      {exact && <Badge className="text-[9px] bg-amber-500 hover:bg-amber-500">EXATO</Badge>}
                      <Badge variant={b.points > 0 ? "default" : "secondary"} className="text-[10px]">{b.points} pts</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
