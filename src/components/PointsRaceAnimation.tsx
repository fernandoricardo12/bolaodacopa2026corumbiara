import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";
import { getAllPointsPaymentStatuses, type PointsPaymentStatus } from "@/lib/pointsPayments.functions";

type Row = { user_id: string; display_name: string; avatar_url: string | null; points: number };
type Bet = { user_id: string; match_id: string; points: number };
type Match = { id: string; kickoff: string; home_score: number | null; away_score: number | null; finished: boolean; live_status_detail: string | null };

function countsForRanking(m?: Match) {
  if (!m || m.home_score === null || m.away_score === null) return false;
  if (m.finished) return true;
  if (new Date(m.kickoff).getTime() > Date.now()) return false;
  const status = (m.live_status_detail ?? "").trim().toLowerCase();
  return !["scheduled", "not started", "pre-game", "pre game"].includes(status);
}

export function PointsRaceAnimation({ currentUserId }: { currentUserId?: string }) {
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
    const payMap = Object.fromEntries(((pays ?? []) as PointsPaymentStatus[]).map((p) => [p.user_id, p]));
    const agg: Record<string, number> = {};
    for (const uid of paidUsers) agg[uid] = 0;
    for (const b of bets as Bet[]) {
      if (!paidUsers.has(b.user_id)) continue;
      if (countsForRanking(matchMap[b.match_id])) agg[b.user_id] = (agg[b.user_id] ?? 0) + (b.points ?? 0);
    }
    const arr: Row[] = Object.entries(agg).map(([uid, points]) => ({
      user_id: uid,
      display_name: profMap[uid]?.display_name ?? payMap[uid]?.display_name ?? "Jogador",
      avatar_url: profMap[uid]?.avatar_url ?? payMap[uid]?.avatar_url ?? null,
      points,
    }));
    arr.sort((a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name, "pt-BR"));
    setRows(arr);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`points-race-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (rows.length === 0) return null;

  const maxPoints = Math.max(1, ...rows.map((r) => r.points));
  const display = rows.slice(0, 12);

  return (
    <Card className="overflow-hidden border-2 border-yellow-400 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-yellow-200">
          <Trophy className="h-4 w-4" /> 🏃‍⚽ Corrida pelos pontos — ao vivo
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* Lines */}
          <div className="absolute inset-y-0 left-12 right-10 pointer-events-none">
            <div className="absolute inset-y-0 left-0 w-px bg-yellow-300/40" />
            <div className="absolute inset-y-0 right-0 w-1 bg-yellow-300 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
            <div className="absolute -top-1 right-0 text-[10px] text-yellow-200 -translate-x-full pr-1 font-bold">🏁</div>
          </div>
          <div className="divide-y divide-emerald-500/40">
            {display.map((r, i) => {
              const pct = (r.points / maxPoints) * 100;
              const isMe = r.user_id === currentUserId;
              return (
                <div key={r.user_id} className="relative h-12 flex items-center">
                  <div className="w-10 text-center text-xs font-bold text-yellow-200 shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                  </div>
                  <div className="relative flex-1 h-full mr-10">
                    {/* track stripe */}
                    <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-0.5 bg-emerald-500/40 border-dashed" />
                    {/* runner */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                      style={{ left: `calc(${pct}% - 32px)` }}
                    >
                      <div className="flex items-center gap-1 animate-bounce" style={{ animationDuration: `${0.6 + (i % 4) * 0.15}s` }}>
                        <Avatar className={`h-7 w-7 border-2 ${isMe ? "border-yellow-300 ring-2 ring-yellow-300/60" : "border-white"} shadow`}>
                          <AvatarImage src={r.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px] bg-yellow-300 text-emerald-900">
                            {r.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] leading-none" aria-hidden>⚽</span>
                      </div>
                      <div className="text-[9px] text-yellow-100 whitespace-nowrap mt-0.5 truncate max-w-[80px] text-center">
                        {r.display_name.split(" ")[0]}
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[11px] font-bold text-yellow-200">
                    {r.points}
                    <span className="text-[8px] font-normal opacity-80">pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="px-3 py-1.5 text-[10px] text-yellow-100/80 bg-black/20 text-center">
          🟢 Atualiza em tempo real conforme os jogos rolam
        </div>
      </CardContent>
    </Card>
  );
}
