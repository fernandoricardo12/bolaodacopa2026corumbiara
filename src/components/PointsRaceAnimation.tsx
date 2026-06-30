import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getPointsRankingData, type PointsPaymentStatus } from "@/lib/pointsPayments.functions";

type Row = { user_id: string; display_name: string; gender: "male" | "female" | null; points: number };
type Bet = { user_id: string; match_id: string; home_score?: number; away_score?: number; points: number };
type Match = { id: string; kickoff: string; home_score: number | null; away_score: number | null; finished: boolean; live_status_detail: string | null };

function countsForRanking(m?: Match) {
  if (!m || m.home_score === null || m.away_score === null) return false;
  return true;
}

function calculateBolaoPoints(b: Bet, m?: Match) {
  if (!m || m.home_score === null || m.away_score === null) return 0;
  if (b.home_score === undefined || b.away_score === undefined) return b.points ?? 0;
  if (b.home_score === m.home_score && b.away_score === m.away_score) return 20;
  const winnerOk = Math.sign(b.home_score - b.away_score) === Math.sign(m.home_score - m.away_score);
  const oneScoreOk = b.home_score === m.home_score || b.away_score === m.away_score;
  if (winnerOk && oneScoreOk) return 15;
  if (winnerOk) return 10;
  if (oneScoreOk) return 5;
  return 0;
}

function inferGender(name: string): "male" | "female" {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  // Common Portuguese female endings
  if (/(a|ia|ana|ela|ele|ice|ina|ene|sa|ra|da|na|la|ta)$/.test(first)) {
    // Exceptions (male names ending in 'a')
    const maleExceptions = ["luca", "joshua", "isaías", "elias", "tobias", "matias", "noah"];
    if (!maleExceptions.includes(first)) return "female";
  }
  return "male";
}

export function PointsRaceAnimation({ currentUserId }: { currentUserId?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const loadSeq = useRef(0);
  const fetchRanking = useServerFn(getPointsRankingData);

  async function load() {
    const seq = ++loadSeq.current;
    const data = await fetchRanking();
    if (seq !== loadSeq.current) return;
    const bets = data.bets as Bet[];
    const profiles = data.profiles as { id: string; display_name: string; gender?: "male" | "female" | null }[];
    const pays = data.payments as PointsPaymentStatus[];
    const matchMap = Object.fromEntries(((data.matches ?? []) as Match[]).map((m) => [m.id, m]));
    const paidUsers = new Set(pays.filter((p) => p.status === "confirmed").map((p) => p.user_id));
    const profMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const payMap = Object.fromEntries(pays.map((p) => [p.user_id, p]));
    const agg: Record<string, number> = {};
    for (const uid of paidUsers) agg[uid] = 0;
    for (const b of bets as Bet[]) {
      if (!paidUsers.has(b.user_id)) continue;
      if (countsForRanking(matchMap[b.match_id])) agg[b.user_id] = (agg[b.user_id] ?? 0) + calculateBolaoPoints(b, matchMap[b.match_id]);
    }
    const arr: Row[] = Object.entries(agg).map(([uid, points]) => {
      const name = profMap[uid]?.display_name ?? payMap[uid]?.display_name ?? "Jogador";
      const g = (profMap[uid]?.gender as "male" | "female" | null) ?? inferGender(name);
      return { user_id: uid, display_name: name, gender: g, points };
    });
    arr.sort((a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name, "pt-BR"));
    setRows(arr);
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    const ch = supabase
      .channel(`points-race-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { window.clearInterval(interval); supabase.removeChannel(ch); };
  }, []);

  if (rows.length === 0) return null;

  const maxPoints = Math.max(1, ...rows.map((r) => r.points));
  const display = rows.slice(0, 12);

  return (
    <Card className="overflow-hidden border border-yellow-400 bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white">
      <CardHeader className="py-1.5 px-3">
        <CardTitle className="text-[11px] flex items-center gap-1 text-yellow-200">
          <Trophy className="h-3 w-3" /> 🏃‍⚽ Corrida pelos pontos
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div className="absolute inset-y-0 left-7 right-8 pointer-events-none">
            <div className="absolute inset-y-0 left-0 w-px bg-yellow-300/40" />
            <div className="absolute inset-y-0 right-0 w-0.5 bg-yellow-300 shadow-[0_0_4px_rgba(250,204,21,0.8)]" />
          </div>
          <div className="divide-y divide-emerald-500/30">
            {display.map((r, i) => {
              const pct = (r.points / maxPoints) * 100;
              const isMe = r.user_id === currentUserId;
              return (
                <div key={r.user_id} className="relative h-7 flex items-center">
                  <div className="w-7 text-center text-[9px] font-bold text-yellow-200 shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                  </div>
                  <div className="relative flex-1 h-full mr-8">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-yellow-300/25" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                      style={{ left: `calc(${pct}% - 11px)` }}
                    >
                      <div
                        className={`${isMe ? "drop-shadow-[0_0_4px_rgba(253,224,71,0.9)]" : ""} animate-bounce`}
                        style={{ animationDuration: `${0.7 + (i % 4) * 0.15}s` }}
                      >
                        <PlayerAvatar
                          userId={r.user_id}
                          gender={r.gender ?? inferGender(r.display_name)}
                          size={22}
                          hasBall
                        />
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-baseline gap-0.5 text-yellow-200">
                    <span className="text-[10px] font-extrabold leading-none">{r.points}</span>
                    <span className="text-[7px] opacity-70">pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
