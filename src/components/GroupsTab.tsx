import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Team = { id: string; name: string; flag: string; code: string; group_name: string };
type Match = {
  id: string; home_team_id: string; away_team_id: string;
  group_name: string | null; stage: string;
  home_score: number | null; away_score: number | null; finished: boolean;
};

type Row = {
  team: Team; pts: number; pj: number; v: number; e: number; d: number; gp: number; gc: number; sg: number;
};

export function GroupsTab() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  async function load() {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("teams").select("*").order("group_name"),
      supabase.from("matches").select("*").eq("stage", "group"),
    ]);
    if (t) setTeams(t as Team[]);
    if (m) setMatches(m as Match[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("groups-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const groups = useMemo(() => {
    const byGroup: Record<string, Team[]> = {};
    teams.forEach((t) => { (byGroup[t.group_name] ||= []).push(t); });

    const result: { name: string; rows: Row[] }[] = [];
    Object.keys(byGroup).sort().forEach((g) => {
      const init: Record<string, Row> = {};
      byGroup[g].forEach((t) => { init[t.id] = { team: t, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 }; });
      matches.filter((m) => m.group_name === g && m.finished && m.home_score !== null && m.away_score !== null)
        .forEach((m) => {
          const h = init[m.home_team_id]; const a = init[m.away_team_id];
          if (!h || !a) return;
          h.pj++; a.pj++;
          h.gp += m.home_score!; h.gc += m.away_score!;
          a.gp += m.away_score!; a.gc += m.home_score!;
          if (m.home_score! > m.away_score!) { h.v++; h.pts += 3; a.d++; }
          else if (m.home_score! < m.away_score!) { a.v++; a.pts += 3; h.d++; }
          else { h.e++; a.e++; h.pts++; a.pts++; }
        });
      const rows = Object.values(init).map((r) => ({ ...r, sg: r.gp - r.gc }))
        .sort((x, y) => y.pts - x.pts || y.sg - x.sg || y.gp - x.gp || x.team.name.localeCompare(y.team.name));
      result.push({ name: g, rows });
    });
    return result;
  }, [teams, matches]);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {groups.map((g) => (
        <Card key={g.name}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Grupo {g.name}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-muted-foreground">
                  <th className="text-left p-2 font-medium">Time</th>
                  <th className="p-2 font-medium" title="Pontos">P</th>
                  <th className="p-2 font-medium" title="Jogos">J</th>
                  <th className="p-2 font-medium" title="Vitórias">V</th>
                  <th className="p-2 font-medium" title="Empates">E</th>
                  <th className="p-2 font-medium" title="Derrotas">D</th>
                  <th className="p-2 font-medium" title="Saldo de gols">SG</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, idx) => (
                  <tr key={r.team.id} className="border-t">
                    <td className="p-2 flex items-center gap-2">
                      <Badge variant={idx < 2 ? "default" : idx === 2 ? "secondary" : "outline"} className="w-5 h-5 p-0 grid place-items-center text-[10px]">{idx + 1}</Badge>
                      <span>{r.team.flag}</span>
                      <span className="truncate">{r.team.name}</span>
                    </td>
                    <td className="text-center p-2 font-bold">{r.pts}</td>
                    <td className="text-center p-2">{r.pj}</td>
                    <td className="text-center p-2">{r.v}</td>
                    <td className="text-center p-2">{r.e}</td>
                    <td className="text-center p-2">{r.d}</td>
                    <td className="text-center p-2">{r.sg > 0 ? `+${r.sg}` : r.sg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
      <p className="text-[11px] text-muted-foreground sm:col-span-2 text-center">
        Os 2 primeiros de cada grupo + 8 melhores 3º colocados avançam para a fase de 16 avos.
      </p>
    </div>
  );
}
