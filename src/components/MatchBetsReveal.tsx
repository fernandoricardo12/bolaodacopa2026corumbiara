import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy } from "lucide-react";

type Row = {
  user_id: string;
  home_score: number;
  away_score: number;
  points: number;
};
type Profile = { id: string; display_name: string | null };

export function MatchBetsReveal({
  matchId,
  matchStarted,
  finalHome,
  finalAway,
}: {
  matchId: string;
  matchStarted: boolean;
  finalHome: number | null;
  finalAway: number | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [open, setOpen] = useState(false);

  function displayPoints(r: Row) {
    if (finalHome === null || finalAway === null) return 0;
    if (r.home_score === finalHome && r.away_score === finalAway) return 20;
    const winnerOk = Math.sign(r.home_score - r.away_score) === Math.sign(finalHome - finalAway);
    const oneScoreOk = r.home_score === finalHome || r.away_score === finalAway;
    if (winnerOk && oneScoreOk) return 15;
    if (winnerOk) return 10;
    if (oneScoreOk) return 5;
    return 0;
  }

  useEffect(() => {
    if (!matchStarted) return;
    let alive = true;
    async function load() {
      const { data: bs } = await supabase
        .from("bets")
        .select("user_id,home_score,away_score,points")
        .eq("match_id", matchId);
      if (!alive || !bs) return;
      setRows(bs as Row[]);
      const ids = Array.from(new Set(bs.map((b: any) => b.user_id)));
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", ids);
        if (alive && ps) setProfiles(Object.fromEntries(ps.map((p: any) => [p.id, p])));
      }
    }
    load();
    const ch = supabase
      .channel(`match-bets-${matchId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `match_id=eq.${matchId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [matchId, matchStarted]);

  if (!matchStarted) return null;

  const sorted = [...rows].sort((a, b) => displayPoints(b) - displayPoints(a));
  const hasFinal = finalHome !== null && finalAway !== null;

  return (
    <div className="rounded-md border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold"
      >
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Palpites de todos ({rows.length})
        </span>
        <span className="text-muted-foreground">{open ? "ocultar" : "ver"}</span>
      </button>
      {open && (
        <div className="divide-y border-t max-h-72 overflow-y-auto">
          {sorted.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhum palpite registrado.</div>
          )}
          {sorted.map((r) => {
            const name = profiles[r.user_id]?.display_name || "Participante";
            const exact = hasFinal && r.home_score === finalHome && r.away_score === finalAway;
            const points = displayPoints(r);
            return (
              <div key={r.user_id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{name}</span>
                <span className="tabular-nums font-semibold">{r.home_score} × {r.away_score}</span>
                {hasFinal && (
                  <Badge variant={exact ? "default" : points > 0 ? "secondary" : "outline"} className="text-[10px] gap-1">
                    <Trophy className="h-2.5 w-2.5" />
                    {points} pts
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
