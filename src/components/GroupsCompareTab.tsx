import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Team = { id: string; name: string; flag: string; code: string; group_name: string };
type Match = {
  id: string; home_team_id: string; away_team_id: string;
  group_name: string | null; stage: string;
  home_score: number | null; away_score: number | null; finished: boolean;
  is_friendly?: boolean;
};
type Bet = { match_id: string; home_score: number; away_score: number };

type Row = { team: Team; pj: number; v: number; e: number; d: number; gp: number; gc: number; sg: number; pts: number };

function computeStandings(teams: Team[], matches: Match[], scoreOf: (m: Match) => [number, number] | null): Row[] {
  const rows: Record<string, Row> = {};
  teams.forEach(t => { rows[t.id] = { team: t, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 }; });
  matches.forEach(m => {
    const s = scoreOf(m); if (!s) return;
    const [h, a] = s;
    const rh = rows[m.home_team_id], ra = rows[m.away_team_id];
    if (!rh || !ra) return;
    rh.pj++; ra.pj++;
    rh.gp += h; rh.gc += a; ra.gp += a; ra.gc += h;
    if (h > a) { rh.v++; rh.pts += 3; ra.d++; }
    else if (h < a) { ra.v++; ra.pts += 3; rh.d++; }
    else { rh.e++; ra.e++; rh.pts++; ra.pts++; }
  });
  return Object.values(rows).map(r => ({ ...r, sg: r.gp - r.gc }))
    .sort((x, y) => y.pts - x.pts || y.sg - x.sg || y.gp - x.gp || x.team.name.localeCompare(y.team.name));
}

function MiniTable({ rows, title, accent }: { rows: Row[]; title: string; accent: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`px-2 py-1.5 text-[11px] font-bold rounded-t ${accent}`}>{title}</div>
      <table className="w-full text-[11px] border border-t-0 rounded-b">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left p-1.5 font-medium">#</th>
            <th className="text-left p-1.5 font-medium">Time</th>
            <th className="p-1.5 font-medium">P</th>
            <th className="p-1.5 font-medium">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const color = i === 0 ? "bg-yellow-400 text-yellow-950" : i === 1 ? "bg-emerald-400 text-emerald-950" : i === 2 ? "bg-sky-400 text-sky-950" : "bg-muted text-muted-foreground";
            return (
              <tr key={r.team.id} className="border-t">
                <td className="p-1.5"><span className={`inline-flex items-center justify-center rounded px-1 py-0.5 text-[10px] font-bold ${color}`}>{i + 1}º</span></td>
                <td className="p-1.5"><div className="flex items-center gap-1 min-w-0"><span>{r.team.flag}</span><span className="truncate">{r.team.name}</span></div></td>
                <td className="text-center p-1.5 font-bold">{r.pts}</td>
                <td className="text-center p-1.5">{r.sg > 0 ? `+${r.sg}` : r.sg}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GroupsCompareTab({ userId }: { userId: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<Record<string, Bet>>({});

  async function load() {
    const [{ data: t }, { data: m }, { data: b }] = await Promise.all([
      supabase.from("teams").select("*").order("group_name"),
      supabase.from("matches").select("*").eq("stage", "group"),
      supabase.from("bets").select("match_id,home_score,away_score").eq("user_id", userId),
    ]);
    if (t) setTeams(t as Team[]);
    if (m) setMatches((m as Match[]).filter(x => !x.is_friendly));
    if (b) setBets(Object.fromEntries(b.map(x => [x.match_id, x as Bet])));
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("groups-compare-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const groups = useMemo(() => {
    const byGroup: Record<string, Team[]> = {};
    teams.forEach(t => { (byGroup[t.group_name] ||= []).push(t); });
    return Object.keys(byGroup).sort().map(g => {
      const groupTeams = byGroup[g];
      const groupMatches = matches.filter(m => m.group_name === g);
      const real = computeStandings(groupTeams, groupMatches, m =>
        m.finished && m.home_score !== null && m.away_score !== null ? [m.home_score, m.away_score] : null);
      const mine = computeStandings(groupTeams, groupMatches, m => {
        const b = bets[m.id];
        if (b) return [b.home_score, b.away_score];
        if (m.finished && m.home_score !== null && m.away_score !== null) return [m.home_score, m.away_score];
        return null;
      });
      const filled = groupMatches.filter(m => bets[m.id] || m.finished).length;
      return { name: g, total: groupMatches.length, filled, real, mine };
    });
  }, [teams, matches, bets]);

  return (
    <div className="space-y-3">
      <Card className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
        <CardContent className="p-3 text-xs text-emerald-800 dark:text-emerald-200">
          Compare a <strong>classificação real</strong> de cada grupo com a <strong>sua projeção</strong> (resultados reais + seus palpites para jogos futuros).
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {groups.map(g => (
          <Card key={g.name}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm">Grupo {g.name}</div>
                <Badge variant="outline" className="text-[10px]">{g.filled}/{g.total} preenchidos</Badge>
              </div>
              <div className="flex gap-2">
                <MiniTable rows={g.real} title="🎯 Real" accent="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
                <MiniTable rows={g.mine} title="🎲 Sua aposta" accent="bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
