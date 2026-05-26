import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

type Team = { id: string; name: string; flag: string };
type KO = {
  id: string; round: string; position: number; label: string;
  home_team_id: string | null; away_team_id: string | null;
  home_source: string | null; away_source: string | null;
  home_score: number | null; away_score: number | null;
  kickoff: string | null; venue: string | null; finished: boolean;
};

const ROUND_LABEL: Record<string, string> = {
  R32: "32 avos de final", R16: "Oitavas de final", QF: "Quartas de final",
  SF: "Semifinais", THIRD: "Disputa de 3º", FINAL: "Final",
};
const ORDER = ["R32", "R16", "QF", "SF", "THIRD", "FINAL"];

export function KnockoutTab() {
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [ko, setKo] = useState<KO[]>([]);

  async function load() {
    const [{ data: t }, { data: k }] = await Promise.all([
      supabase.from("teams").select("id,name,flag"),
      supabase.from("knockout_matches").select("*").order("position"),
    ]);
    if (t) setTeams(Object.fromEntries(t.map((x) => [x.id, x as Team])));
    if (k) setKo(k as KO[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("ko-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "knockout_matches" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4">
      {ORDER.map((round) => {
        const list = ko.filter((k) => k.round === round);
        if (list.length === 0) return null;
        return (
          <Card key={round}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {round === "FINAL" && <Trophy className="h-4 w-4 text-amber-500" />}
                {ROUND_LABEL[round]}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              {list.map((m) => {
                const h = m.home_team_id ? teams[m.home_team_id] : null;
                const a = m.away_team_id ? teams[m.away_team_id] : null;
                return (
                  <div key={m.id} className="border rounded-md p-3 text-sm bg-card">
                    <div className="text-[10px] text-muted-foreground mb-1">{m.label}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <span>{h?.flag ?? "🏳️"}</span>
                        <span className="truncate">{h?.name ?? <em className="text-muted-foreground">{m.home_source ?? "A definir"}</em>}</span>
                      </div>
                      <div className="font-bold tabular-nums whitespace-nowrap">
                        {m.finished ? `${m.home_score} × ${m.away_score}` : "—"}
                      </div>
                      <div className="flex items-center gap-1 min-w-0 justify-end">
                        <span className="truncate text-right">{a?.name ?? <em className="text-muted-foreground">{m.away_source ?? "A definir"}</em>}</span>
                        <span>{a?.flag ?? "🏳️"}</span>
                      </div>
                    </div>
                    {m.kickoff && <div className="text-[10px] text-muted-foreground mt-1">{new Date(m.kickoff).toLocaleString("pt-BR")}{m.venue ? ` · ${m.venue}` : ""}</div>}
                    {m.finished && <Badge variant="secondary" className="mt-2 text-[10px]">Encerrado</Badge>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
