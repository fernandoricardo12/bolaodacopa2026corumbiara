import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, RotateCcw, Sparkles } from "lucide-react";

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

// Ordem dos times no chaveamento R32 (32 slots).
// Pareamento por proximidade no array: (0,1) (2,3) ... formando 16 jogos.
// Estrutura simplificada baseada no formato 2026 (top 2 de cada grupo + 8 melhores 3ºs).
const SEED_ORDER = [
  // Slot index → fonte ("A1" = 1º do grupo A, "T1".."T8" = melhores 3ºs colocados ranqueados)
  "A1","B2", "C1","D2", "E1","F2", "G1","H2",
  "I1","J2", "K1","L2", "A2","B1", "C2","D1",
  "E2","F1", "G2","H1", "I2","J1", "K2","L1",
  "T1","T8", "T2","T7", "T3","T6", "T4","T5",
];

type SlotKey = string; // e.g. "A1", "T3", or "W:R32-3"
type Pick = string | null; // team id

function pairings(slots: SlotKey[]): [SlotKey, SlotKey][] {
  const out: [SlotKey, SlotKey][] = [];
  for (let i = 0; i < slots.length; i += 2) out.push([slots[i], slots[i + 1]]);
  return out;
}

const ROUNDS = ["R32", "R16", "QF", "SF", "FINAL"] as const;
const ROUND_LABEL: Record<typeof ROUNDS[number], string> = {
  R32: "32 avos", R16: "Oitavas", QF: "Quartas", SF: "Semifinais", FINAL: "Final",
};

export function SimulatorTab({ userId }: { userId: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [picks, setPicks] = useState<Record<string, Pick>>({}); // key = `${round}-${matchIdx}`

  useEffect(() => {
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
    load();
  }, [userId]);

  // Standings projetadas (resultado real + palpites do usuário para jogos futuros)
  const groupStandings = useMemo(() => {
    const byGroup: Record<string, Team[]> = {};
    teams.forEach(t => { (byGroup[t.group_name] ||= []).push(t); });
    const result: Record<string, Row[]> = {};
    Object.keys(byGroup).forEach(g => {
      const gm = matches.filter(m => m.group_name === g);
      result[g] = computeStandings(byGroup[g], gm, m => {
        const b = bets[m.id];
        if (b) return [b.home_score, b.away_score];
        if (m.finished && m.home_score !== null && m.away_score !== null) return [m.home_score, m.away_score];
        return null;
      });
    });
    return result;
  }, [teams, matches, bets]);

  // Resolve fonte (ex. "A1", "T3") → team id ou null
  const resolveSource = useCallback((src: SlotKey): Pick => {
    if (!src) return null;
    if (src.length === 2 && /[A-L]/.test(src[0])) {
      const g = src[0]; const pos = parseInt(src[1], 10) - 1;
      const r = groupStandings[g]?.[pos];
      return r ? r.team.id : null;
    }
    if (src[0] === "T") {
      // melhores 3ºs colocados
      const thirds: Row[] = [];
      Object.values(groupStandings).forEach(rows => { if (rows[2]) thirds.push(rows[2]); });
      thirds.sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || a.team.name.localeCompare(b.team.name));
      const idx = parseInt(src.slice(1), 10) - 1;
      return thirds[idx]?.team.id ?? null;
    }
    return null;
  }, [groupStandings]);

  // Constrói slots de cada rodada a partir dos picks
  const bracket = useMemo(() => {
    const rounds: Record<string, { home: Pick; away: Pick; }[]> = {};

    // R32: 16 jogos pelos SEED_ORDER
    const r32Slots = SEED_ORDER.map(resolveSource);
    rounds.R32 = pairings(r32Slots.map((_, i) => `__${i}`)).map(([_h, _a], i) => ({
      home: r32Slots[i * 2], away: r32Slots[i * 2 + 1],
    }));

    // Próximas rodadas: vencedor do jogo anterior
    const nextRoundFrom = (prev: string, count: number) => {
      const arr: { home: Pick; away: Pick }[] = [];
      for (let i = 0; i < count; i++) {
        const wA = picks[`${prev}-${i * 2}`] ?? null;
        const wB = picks[`${prev}-${i * 2 + 1}`] ?? null;
        arr.push({ home: wA, away: wB });
      }
      return arr;
    };
    rounds.R16 = nextRoundFrom("R32", 8);
    rounds.QF = nextRoundFrom("R16", 4);
    rounds.SF = nextRoundFrom("QF", 2);
    rounds.FINAL = nextRoundFrom("SF", 1);
    return rounds;
  }, [picks, resolveSource]);

  const teamById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);
  const champion = picks["FINAL-0"] ? teamById[picks["FINAL-0"]] : null;

  function pickWinner(round: string, idx: number, teamId: Pick) {
    if (!teamId) return;
    setPicks(prev => {
      const next = { ...prev, [`${round}-${idx}`]: teamId };
      // Limpa picks dependentes a jusante quando muda
      const dependents: Record<string, string[]> = {
        R32: ["R16", "QF", "SF", "FINAL"],
        R16: ["QF", "SF", "FINAL"],
        QF: ["SF", "FINAL"],
        SF: ["FINAL"],
      };
      (dependents[round] ?? []).forEach(r => {
        Object.keys(next).forEach(k => { if (k.startsWith(`${r}-`)) delete next[k]; });
      });
      return next;
    });
  }

  function autoFill() {
    // Heurística: vence o time com melhor SG/pontos na fase de grupos; em empate, o "home".
    const scoreOfTeam = (id: string | null): number => {
      if (!id) return -Infinity;
      for (const rows of Object.values(groupStandings)) {
        const r = rows.find(x => x.team.id === id);
        if (r) return r.pts * 100 + r.sg * 10 + r.gp;
      }
      return 0;
    };
    const next: Record<string, Pick> = {};
    // R32
    bracket.R32.forEach((g, i) => {
      const w = scoreOfTeam(g.home) >= scoreOfTeam(g.away) ? g.home : g.away;
      if (w) next[`R32-${i}`] = w;
    });
    // R16
    for (let i = 0; i < 8; i++) {
      const h = next[`R32-${i * 2}`]; const a = next[`R32-${i * 2 + 1}`];
      if (h && a) next[`R16-${i}`] = scoreOfTeam(h) >= scoreOfTeam(a) ? h : a;
    }
    for (let i = 0; i < 4; i++) {
      const h = next[`R16-${i * 2}`]; const a = next[`R16-${i * 2 + 1}`];
      if (h && a) next[`QF-${i}`] = scoreOfTeam(h) >= scoreOfTeam(a) ? h : a;
    }
    for (let i = 0; i < 2; i++) {
      const h = next[`QF-${i * 2}`]; const a = next[`QF-${i * 2 + 1}`];
      if (h && a) next[`SF-${i}`] = scoreOfTeam(h) >= scoreOfTeam(a) ? h : a;
    }
    const fh = next["SF-0"]; const fa = next["SF-1"];
    if (fh && fa) next["FINAL-0"] = scoreOfTeam(fh) >= scoreOfTeam(fa) ? fh : fa;
    setPicks(next);
  }

  function TeamBtn({ id, onClick, selected }: { id: Pick; onClick?: () => void; selected?: boolean }) {
    const t = id ? teamById[id] : null;
    return (
      <button
        onClick={onClick}
        disabled={!t}
        className={`flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-xs rounded border transition-all ${
          selected ? "bg-emerald-500 text-white border-emerald-600 font-bold shadow"
          : t ? "bg-card hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-border cursor-pointer"
          : "bg-muted/40 text-muted-foreground border-dashed cursor-not-allowed"
        }`}
      >
        <span>{t?.flag ?? "🏳️"}</span>
        <span className="truncate text-left">{t?.name ?? "A definir"}</span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-50 to-yellow-50 dark:from-emerald-950/40 dark:to-yellow-950/20">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <div className="text-sm font-bold">Simulador do Mata-mata</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={autoFill} className="h-7 text-xs"><Sparkles className="h-3 w-3 mr-1" />Preencher auto</Button>
              <Button size="sm" variant="ghost" onClick={() => setPicks({})} className="h-7 text-xs"><RotateCcw className="h-3 w-3 mr-1" />Limpar</Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Os classificados são montados a partir da <strong>sua projeção de grupos</strong> (resultados reais + seus palpites). Clique no time que avança em cada confronto. O campeão aparece no topo da Final.
          </p>
        </CardContent>
      </Card>

      {champion && (
        <Card className="border-yellow-400 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40">
          <CardContent className="p-3 flex items-center justify-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            <div className="text-sm font-bold">Seu campeão: {champion.flag} {champion.name}</div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {ROUNDS.map((round) => {
          const games = bracket[round] ?? [];
          return (
            <div key={round} className="flex-shrink-0 w-[230px] space-y-2">
              <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur px-1 py-1 rounded">
                <Badge variant="outline" className="text-[10px]">{ROUND_LABEL[round]}</Badge>
                <span className="text-[10px] text-muted-foreground">{games.length} {games.length === 1 ? "jogo" : "jogos"}</span>
              </div>
              <div className="space-y-2">
                {games.map((g, i) => {
                  const winner = picks[`${round}-${i}`] ?? null;
                  return (
                    <Card key={i} className={`${winner ? "border-emerald-400" : ""}`}>
                      <CardContent className="p-2 space-y-1">
                        <div className="text-[10px] text-muted-foreground">Jogo {i + 1}</div>
                        <div className="flex flex-col gap-1">
                          <TeamBtn id={g.home} selected={winner === g.home && !!winner} onClick={() => pickWinner(round, i, g.home)} />
                          <div className="text-[9px] text-center text-muted-foreground">vs</div>
                          <TeamBtn id={g.away} selected={winner === g.away && !!winner} onClick={() => pickWinner(round, i, g.away)} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
