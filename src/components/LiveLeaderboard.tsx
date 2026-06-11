import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal } from "lucide-react";
import { getAllPointsPaymentStatuses, type PointsPaymentStatus } from "@/lib/pointsPayments.functions";

type Row = { user_id: string; display_name: string; avatar_url: string | null; points: number; bets: number };
type Bet = { user_id: string; match_id: string; points: number };
type Match = { id: string; kickoff: string; home_score: number | null; away_score: number | null; finished: boolean; live_status_detail: string | null };

function countsForRanking(m?: Match) {
  if (!m || m.home_score === null || m.away_score === null) return false;
  if (m.finished) return true;
  if (new Date(m.kickoff).getTime() > Date.now()) return false;
  const status = (m.live_status_detail ?? "").trim().toLowerCase();
  return !["scheduled", "not started", "pre-game", "pre game"].includes(status);
}

export function LiveLeaderboard({ currentUserId, limit = 5, title = "🏆 Ranking ao vivo" }: { currentUserId?: string; limit?: number; title?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const fetchPayments = useServerFn(getAllPointsPaymentStatuses);

  async function load() {
    const [{ data: bets }, { data: profiles }, pays, { data: matches }] = await Promise.all([
      supabase.from("bets").select("user_id,match_id,points"),
      supabase.from("profiles").select("id,display_name,avatar_url"),
      fetchPayments(),
      supabase.from("matches").select("id,kickoff,home_score,away_score,finished,live_status_detail"),
    ]);
    if (!bets || !profiles) return;
    const matchMap = Object.fromEntries(((matches ?? []) as Match[]).map((m) => [m.id, m]));
    const paidUsers = new Set(((pays ?? []) as PointsPaymentStatus[]).filter((p) => p.status === "confirmed").map((p) => p.user_id));
    const profMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const paymentMap = Object.fromEntries(((pays ?? []) as PointsPaymentStatus[]).map((p) => [p.user_id, p]));
    const agg: Record<string, { points: number; bets: number }> = {};
    for (const b of bets as Bet[]) {
      if (!paidUsers.has(b.user_id)) continue;
      agg[b.user_id] ??= { points: 0, bets: 0 };
      agg[b.user_id].points += countsForRanking(matchMap[b.match_id]) ? b.points : 0;
      agg[b.user_id].bets += 1;
    }
    for (const uid of paidUsers) agg[uid] ??= { points: 0, bets: 0 };
    const arr: Row[] = Object.entries(agg).map(([uid, v]) => ({
      user_id: uid,
      display_name: profMap[uid]?.display_name ?? paymentMap[uid]?.display_name ?? "Jogador",
      avatar_url: profMap[uid]?.avatar_url ?? paymentMap[uid]?.avatar_url ?? null,
      points: v.points,
      bets: v.bets,
    }));
    arr.sort((a, b) => b.points - a.points || b.bets - a.bets || a.display_name.localeCompare(b.display_name, "pt-BR"));
    setRows(arr);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`live-leaderboard-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const top = rows.slice(0, limit);
  const myIndex = currentUserId ? rows.findIndex((r) => r.user_id === currentUserId) : -1;
  const showMine = myIndex >= limit;

  const medal = (i: number) =>
    i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-700" : "text-muted-foreground";

  if (rows.length === 0) return null;

  return (
    <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-emerald-50 dark:from-yellow-950/20 dark:to-emerald-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y">
        {top.map((r, i) => (
          <Row key={r.user_id} r={r} i={i} isMe={r.user_id === currentUserId} medalClass={medal(i)} />
        ))}
        {showMine && (
          <>
            <div className="px-3 py-1 text-[10px] text-muted-foreground bg-muted/40">sua posição</div>
            <Row r={rows[myIndex]} i={myIndex} isMe medalClass={medal(myIndex)} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ r, i, isMe, medalClass }: { r: Row; i: number; isMe: boolean; medalClass: string }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 ${isMe ? "bg-emerald-100/60 dark:bg-emerald-950/40" : ""}`}>
      <div className="w-6 flex items-center justify-center">
        {i < 3 ? <Medal className={`h-4 w-4 ${medalClass}`} /> : <span className="text-xs font-medium text-muted-foreground">{i + 1}</span>}
      </div>
      <Avatar className="h-7 w-7">
        <AvatarImage src={r.avatar_url ?? undefined} />
        <AvatarFallback className="text-[10px]">{r.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{r.display_name}</div>
        <div className="text-[10px] text-muted-foreground">{r.bets} palpites</div>
      </div>
      <div className="flex items-center gap-1 font-bold text-sm">
        <Trophy className="h-3.5 w-3.5 text-amber-500" />
        {r.points}
        <span className="text-[10px] text-muted-foreground font-normal ml-0.5">pts</span>
      </div>
    </div>
  );
}
