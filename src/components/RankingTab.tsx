import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal } from "lucide-react";
import podium from "@/assets/podium.jpg";
import { HighlightsSection } from "@/components/HighlightsSection";

type Row = { user_id: string; display_name: string; avatar_url: string | null; points: number; bets: number };

export function RankingTab({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const [{ data: bets }, { data: profiles }, { data: pays }] = await Promise.all([
      supabase.from("bets").select("user_id,points"),
      supabase.from("profiles").select("id,display_name,avatar_url"),
      supabase.from("payments").select("user_id,mode,status").eq("mode", "points").eq("status", "confirmed"),
    ]);
    if (!bets || !profiles) return;
    const paidUsers = new Set((pays ?? []).map((p: any) => p.user_id));
    const profMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const agg: Record<string, { points: number; bets: number }> = {};
    for (const b of bets) {
      if (!paidUsers.has(b.user_id)) continue;
      agg[b.user_id] ??= { points: 0, bets: 0 };
      agg[b.user_id].points += b.points;
      agg[b.user_id].bets += 1;
    }
    // include paid profiles even with no bets yet
    for (const p of profiles) if (paidUsers.has(p.id)) agg[p.id] ??= { points: 0, bets: 0 };
    const arr: Row[] = Object.entries(agg).map(([uid, v]) => ({
      user_id: uid,
      display_name: profMap[uid]?.display_name ?? "Jogador",
      avatar_url: profMap[uid]?.avatar_url ?? null,
      points: v.points,
      bets: v.bets,
    }));
    arr.sort((a, b) => b.points - a.points || b.bets - a.bets);
    setRows(arr);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ranking-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const medal = (i: number) =>
    i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-700" : "text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border-2 border-yellow-400 shadow">
        <img src={podium} alt="Pódio dos campeões" className="w-full h-28 sm:h-36 object-cover" loading="lazy" width={1280} height={640} />
      </div>
      <HighlightsSection />
      <Card>
        <CardContent className="p-0 divide-y">
        {rows.length === 0 && <p className="p-6 text-center text-muted-foreground">Sem jogadores ainda.</p>}
        {rows.map((r, i) => (
          <div key={r.user_id} className={`flex items-center gap-3 p-3 ${r.user_id === currentUserId ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
            <div className="w-8 flex items-center justify-center">
              {i < 3 ? <Medal className={`h-5 w-5 ${medal(i)}`} /> : <span className="text-sm font-medium text-muted-foreground">{i + 1}</span>}
            </div>
            <Avatar className="h-9 w-9">
              <AvatarImage src={r.avatar_url ?? undefined} />
              <AvatarFallback>{r.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-medium text-sm">{r.display_name}</div>
              <div className="text-xs text-muted-foreground">{r.bets} palpites</div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 font-bold text-lg">
                <Trophy className="h-4 w-4 text-amber-500" /> {r.points}
              </div>
              <div className="text-xs text-muted-foreground">pts</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    </div>
  );
}
