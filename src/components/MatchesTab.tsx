import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Lock, Trophy, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import { FlagImg } from "@/lib/flags";
import { useServerFn } from "@tanstack/react-start";
import { getPointsPrizeSummary } from "@/lib/prizes.functions";
import { calculatePointsPrize } from "@/lib/prizeRules";

type Team = { id: string; name: string; flag: string; code: string; group_name?: string };
type Match = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  group_name: string | null;
  stage: string;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
  is_friendly?: boolean;
  live_clock?: string | null;
  live_period?: number | null;
  live_status_detail?: string | null;
};
type Bet = { match_id: string; home_score: number; away_score: number; points: number };

type Standing = {
  team: Team;
  pj: number; v: number; e: number; d: number;
  gp: number; gc: number; sg: number; pts: number;
  realPj: number; // games actually finished (not projected)
};

const KNOCKOUT_STAGES = ["R32", "R16", "QF", "SF", "THIRD", "FINAL"];
const STAGE_LABEL: Record<string, string> = {
  group: "Fase de Grupos", R32: "32 avos", R16: "Oitavas", QF: "Quartas",
  SF: "Semifinais", THIRD: "Disputa 3º", FINAL: "Final",
};

function hasScore(m: Match) {
  return m.home_score !== null && m.away_score !== null;
}

function matchStatusLabel(m: Match) {
  if (m.finished) return "Encerrado";
  if (hasScore(m)) return m.live_status_detail || m.live_clock || "Ao vivo";
  return "Aguardando";
}

export function MatchesTab({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [drafts, setDrafts] = useState<Record<string, { h: string; a: string }>>({});
  const [pointsPrize, setPointsPrize] = useState(() => calculatePointsPrize(0));
  const [activeGroup, setActiveGroup] = useState<string>("");
  const [roundIdx, setRoundIdx] = useState(0);
  const fetchPointsPrize = useServerFn(getPointsPrizeSummary);

  async function load() {
    const [{ data: ts }, { data: ms }, { data: bs }, prize] = await Promise.all([
      supabase.from("teams").select("id,name,flag,code,group_name"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("bets").select("match_id,home_score,away_score,points").eq("user_id", userId),
      fetchPointsPrize(),
    ]);
    if (ts) setTeams(Object.fromEntries(ts.map((t) => [t.id, t as Team])));
    if (ms) setMatches((ms as Match[]).filter((m) => !m.is_friendly));
    if (bs) setBets(Object.fromEntries(bs.map((b) => [b.match_id, b as Bet])));
    setPointsPrize(prize);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("matches-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // Group matches by group_name and knockout stage
  const sections = useMemo(() => {
    const groupNames = Array.from(new Set(matches.filter(m => m.stage === "group" && m.group_name).map(m => m.group_name!))).sort();
    const stages: { key: string; label: string; matches: Match[] }[] = [];
    groupNames.forEach(g => {
      stages.push({ key: `G-${g}`, label: `Grupo ${g}`, matches: matches.filter(m => m.stage === "group" && m.group_name === g) });
    });
    KNOCKOUT_STAGES.forEach(s => {
      const list = matches.filter(m => m.stage === s);
      if (list.length) stages.push({ key: s, label: STAGE_LABEL[s] ?? s, matches: list });
    });
    return stages;
  }, [matches]);

  // Default active group
  useEffect(() => {
    if (!activeGroup && sections.length) setActiveGroup(sections[0].key);
  }, [sections, activeGroup]);

  const activeSection = sections.find(s => s.key === activeGroup) ?? sections[0];

  // Split active section's matches into rounds (pairs sorted by kickoff). For group: 4 teams → 3 rounds of 2.
  const rounds = useMemo(() => {
    if (!activeSection) return [] as Match[][];
    const ms = [...activeSection.matches].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    if (activeSection.key.startsWith("G-")) {
      // 4 teams, group of 6 matches → 3 rounds of 2. Generic chunk by 2.
      const out: Match[][] = [];
      for (let i = 0; i < ms.length; i += 2) out.push(ms.slice(i, i + 2));
      return out;
    }
    return [ms];
  }, [activeSection]);

  useEffect(() => { setRoundIdx(0); }, [activeGroup]);

  // Compute projected standings for group section using real results + user bets
  const standings = useMemo<Standing[]>(() => {
    if (!activeSection || !activeSection.key.startsWith("G-")) return [];
    const g = activeSection.key.slice(2);
    const groupTeams = Object.values(teams).filter(t => t.group_name === g);
    const rows: Record<string, Standing> = {};
    groupTeams.forEach(t => { rows[t.id] = { team: t, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0, realPj: 0 }; });
    activeSection.matches.forEach(m => {
      let h: number | null = null, a: number | null = null, isReal = false;
      if (hasScore(m)) {
        h = m.home_score; a = m.away_score; isReal = true;
      } else {
        const b = bets[m.id];
        if (b) { h = b.home_score; a = b.away_score; }
      }
      if (h === null || a === null) return;
      const rh = rows[m.home_team_id]; const ra = rows[m.away_team_id];
      if (!rh || !ra) return;
      rh.pj++; ra.pj++;
      rh.gp += h; rh.gc += a; ra.gp += a; ra.gc += h;
      if (isReal) { rh.realPj++; ra.realPj++; }
      if (h > a) { rh.v++; rh.pts += 3; ra.d++; }
      else if (h < a) { ra.v++; ra.pts += 3; rh.d++; }
      else { rh.e++; ra.e++; rh.pts++; ra.pts++; }
    });
    return Object.values(rows).map(r => ({ ...r, sg: r.gp - r.gc }))
      .sort((x, y) => y.pts - x.pts || y.sg - x.sg || y.gp - x.gp || x.team.name.localeCompare(y.team.name));
  }, [activeSection, teams, bets]);

  // Real/live standings: all matches with a registered score
  const realStandings = useMemo<Standing[]>(() => {
    if (!activeSection || !activeSection.key.startsWith("G-")) return [];
    const g = activeSection.key.slice(2);
    const groupTeams = Object.values(teams).filter(t => t.group_name === g);
    const rows: Record<string, Standing> = {};
    groupTeams.forEach(t => { rows[t.id] = { team: t, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0, realPj: 0 }; });
    activeSection.matches.forEach(m => {
      if (!hasScore(m)) return;
      const h = m.home_score, a = m.away_score;
      const rh = rows[m.home_team_id], ra = rows[m.away_team_id];
      if (!rh || !ra) return;
      rh.pj++; ra.pj++; rh.realPj++; ra.realPj++;
      rh.gp += h; rh.gc += a; ra.gp += a; ra.gc += h;
      if (h > a) { rh.v++; rh.pts += 3; ra.d++; }
      else if (h < a) { ra.v++; ra.pts += 3; rh.d++; }
      else { rh.e++; ra.e++; rh.pts++; ra.pts++; }
    });
    return Object.values(rows).map(r => ({ ...r, sg: r.gp - r.gc }))
      .sort((x, y) => y.pts - x.pts || y.sg - x.sg || y.gp - x.gp || x.team.name.localeCompare(y.team.name));
  }, [activeSection, teams]);

  const prizeValue = pointsPrize.finalPrize;

  async function saveBet(matchId: string) {
    const d = drafts[matchId];
    if (!d || d.h === "" || d.a === "") return toast.error("Preencha o placar");
    const h = parseInt(d.h), a = parseInt(d.a);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return toast.error("Placar inválido");
    const { error } = await supabase.from("bets").upsert(
      { user_id: userId, match_id: matchId, home_score: h, away_score: a },
      { onConflict: "user_id,match_id" }
    );
    if (error) toast.error(error.message); else toast.success("Palpite salvo!");
  }

  async function deleteBet(matchId: string) {
    if (!confirm("Excluir seu palpite deste jogo?")) return;
    const { error } = await supabase.from("bets").delete().eq("user_id", userId).eq("match_id", matchId);
    if (error) toast.error(error.message);
    else { toast.success("Palpite excluído"); setDrafts((p) => ({ ...p, [matchId]: { h: "", a: "" } })); }
  }

  const currentRoundMatches = rounds[roundIdx] ?? [];
  const totalRounds = rounds.length;
  const totalMatches = activeSection?.matches.length ?? 0;
  const filledMatches = activeSection?.matches.filter(m => m.finished || bets[m.id]).length ?? 0;

  return (
    <div className="space-y-3">
      {/* Prize banner (compact) */}
      <Card className="border-2 border-yellow-400 bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 text-white shadow-md overflow-hidden">
        <CardContent className="p-2.5 flex items-center gap-2.5">
          <Crown className="h-7 w-7 text-yellow-300 shrink-0" />
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[9px] uppercase tracking-wider font-extrabold text-yellow-200">🏆 Prêmio do líder · Copa 2026</div>
            <div className="text-[10px] text-emerald-50">80% do bolo (R$ {pointsPrize.poolPrize.toFixed(2)}) + R$ {pointsPrize.bonus.toFixed(2)} bônus admin</div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-yellow-300 shrink-0">
            R$ {prizeValue.toFixed(0)}
          </div>
        </CardContent>
      </Card>


      {matches.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum jogo cadastrado ainda.</p>}

      {/* Section tabs (groups + knockout stages, separated) */}
      {sections.length > 0 && (
        <div className="sticky top-14 z-[5] -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b space-y-1.5">
          <div>
            <div className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300 mb-1">Grupos</div>
            <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
              {sections.filter(s => s.key.startsWith("G-")).map(s => (
                <Button key={s.key} size="sm"
                  variant={activeGroup === s.key ? "default" : "outline"}
                  className="h-7 px-2.5 text-[11px] shrink-0"
                  onClick={() => setActiveGroup(s.key)}
                >{s.label}</Button>
              ))}
            </div>
          </div>
          {sections.some(s => !s.key.startsWith("G-")) && (
            <div>
              <div className="text-[9px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300 mb-1">Mata-mata</div>
              <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
                {sections.filter(s => !s.key.startsWith("G-")).map(s => (
                  <Button key={s.key} size="sm"
                    variant={activeGroup === s.key ? "default" : "outline"}
                    className="h-7 px-2.5 text-[11px] shrink-0"
                    onClick={() => setActiveGroup(s.key)}
                  >{s.label}</Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {activeSection && (
        <>



          {/* Round navigator */}
          {totalRounds > 1 && (
            <div className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-2 py-1.5">
              <Button size="sm" variant="ghost" disabled={roundIdx === 0} onClick={() => setRoundIdx(i => Math.max(0, i - 1))}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <div className="text-xs font-bold">
                {activeSection.key.startsWith("G-") ? `${roundIdx + 1}ª Rodada` : `Jogos (${currentRoundMatches.length})`}
                <span className="text-muted-foreground font-normal ml-1">· {roundIdx + 1}/{totalRounds}</span>
              </div>
              <Button size="sm" variant="ghost" disabled={roundIdx >= totalRounds - 1} onClick={() => setRoundIdx(i => Math.min(totalRounds - 1, i + 1))}>
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Matches in current round */}
          <div className="space-y-2">
            {currentRoundMatches.map((m) => {
              const home = teams[m.home_team_id];
              const away = teams[m.away_team_id];
              if (!home || !away) return null;
              const bet = bets[m.id];
              const locked = m.finished || new Date(m.kickoff).getTime() - Date.now() <= 10 * 60 * 1000;
              const d = drafts[m.id] ?? { h: bet?.home_score?.toString() ?? "", a: bet?.away_score?.toString() ?? "" };
              const scoreAvailable = hasScore(m);
              const statusLabel = matchStatusLabel(m);
              return (
                <Card key={m.id} className={locked ? "opacity-95" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex gap-2 items-center">
                        {m.group_name && <Badge variant="secondary">Grupo {m.group_name}</Badge>}
                        <Clock className="h-3 w-3" />
                        <span>{new Date(m.kickoff).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={m.finished ? "secondary" : scoreAvailable ? "default" : "outline"} className="text-[10px]">
                          {statusLabel}
                        </Badge>
                        {locked && <Lock className="h-3 w-3" />}
                      </div>
                    </div>
                    {m.venue && <p className="text-xs text-muted-foreground">{m.venue}</p>}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
                        <FlagImg code={home.code} name={home.name} size={40} />
                        <div className="text-xs sm:text-sm font-medium text-right truncate w-full">{home.name}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {scoreAvailable ? (
                          <div className="text-center">
                            <div className="text-2xl sm:text-3xl font-bold tabular-nums">{m.home_score}<span className="text-muted-foreground mx-1">×</span>{m.away_score}</div>
                            {!m.finished && <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">placar ao vivo</div>}
                          </div>
                        ) : (
                          <>
                            <Input className="w-12 sm:w-14 text-center text-lg px-1" type="number" inputMode="numeric" min={0} disabled={locked} value={d.h}
                              onChange={(e) => setDrafts({ ...drafts, [m.id]: { ...d, h: e.target.value } })} />
                            <span className="text-muted-foreground">×</span>
                            <Input className="w-12 sm:w-14 text-center text-lg px-1" type="number" inputMode="numeric" min={0} disabled={locked} value={d.a}
                              onChange={(e) => setDrafts({ ...drafts, [m.id]: { ...d, a: e.target.value } })} />
                          </>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
                        <FlagImg code={away.code} name={away.name} size={40} />
                        <div className="text-xs sm:text-sm font-medium truncate w-full">{away.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {bet ? (
                        <div className="text-xs text-muted-foreground">
                          Seu palpite: <strong>{bet.home_score}×{bet.away_score}</strong>
                          {scoreAvailable && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Trophy className="h-3 w-3 text-amber-500" /> {bet.points} pts{!m.finished ? " parciais" : ""}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Sem palpite</span>}
                      {!locked && (
                        <div className="flex gap-2">
                          {bet && <Button size="sm" variant="outline" onClick={() => deleteBet(m.id)}>Excluir</Button>}
                          <Button size="sm" onClick={() => saveBet(m.id)}>{bet ? "Atualizar" : "Palpitar"}</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Standings: projected from bets (below the matches input) */}
          {activeSection.key.startsWith("G-") && standings.length > 0 && (
            <Card className="border-emerald-500/30">
              <CardContent className="p-0">
                <div className="px-3 py-2 border-b bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    📊 Como ficaria o {activeSection.label} com seus palpites
                  </div>
                  <div className="text-[10px] text-muted-foreground">{filledMatches}/{totalMatches} preenchidos</div>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">Time</th>
                      <th className="p-2 font-medium">P</th>
                      <th className="p-2 font-medium">J</th>
                      <th className="p-2 font-medium">V</th>
                      <th className="p-2 font-medium">E</th>
                      <th className="p-2 font-medium">D</th>
                      <th className="p-2 font-medium">SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((r, i) => {
                      const label = i === 0 ? "1º" : i === 1 ? "2º" : i === 2 ? "3º" : "4º";
                      const color = i === 0 ? "bg-yellow-400 text-yellow-950" : i === 1 ? "bg-emerald-400 text-emerald-950" : i === 2 ? "bg-sky-400 text-sky-950" : "bg-muted text-muted-foreground";
                      const projected = r.pj > r.realPj;
                      return (
                        <tr key={r.team.id} className="border-t">
                          <td className="p-2"><span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>{label}</span></td>
                          <td className="p-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span>{r.team.flag}</span>
                              <span className="truncate">{r.team.name}</span>
                              {projected && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">previsto</Badge>}
                            </div>
                          </td>
                          <td className="text-center p-2 font-bold">{r.pts}</td>
                          <td className="text-center p-2">{r.pj}</td>
                          <td className="text-center p-2">{r.v}</td>
                          <td className="text-center p-2">{r.e}</td>
                          <td className="text-center p-2">{r.d}</td>
                          <td className="text-center p-2">{r.sg > 0 ? `+${r.sg}` : r.sg}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t text-[10px] text-muted-foreground bg-muted/20">
                  Os 2 primeiros + melhores 3º colocados se classificam. Esta projeção combina resultados reais com seus palpites.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Real/live standings */}
          {activeSection.key.startsWith("G-") && realStandings.length > 0 && (
            <Card className="border-slate-300 dark:border-slate-700">
              <CardContent className="p-0">
                <div className="px-3 py-2 border-b bg-slate-100 dark:bg-slate-900/40 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    🎯 Classificação real/ao vivo do {activeSection.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {realStandings.reduce((s, r) => s + r.realPj, 0) / 2} jogo(s) com placar
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">Time</th>
                      <th className="p-2 font-medium">P</th>
                      <th className="p-2 font-medium">J</th>
                      <th className="p-2 font-medium">V</th>
                      <th className="p-2 font-medium">E</th>
                      <th className="p-2 font-medium">D</th>
                      <th className="p-2 font-medium">SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realStandings.map((r, i) => {
                      const color = i === 0 ? "bg-yellow-400 text-yellow-950" : i === 1 ? "bg-emerald-400 text-emerald-950" : i === 2 ? "bg-sky-400 text-sky-950" : "bg-muted text-muted-foreground";
                      return (
                        <tr key={r.team.id} className="border-t">
                          <td className="p-2"><span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>{i + 1}º</span></td>
                          <td className="p-2"><div className="flex items-center gap-1.5 min-w-0"><span>{r.team.flag}</span><span className="truncate">{r.team.name}</span></div></td>
                          <td className="text-center p-2 font-bold">{r.pts}</td>
                          <td className="text-center p-2">{r.pj}</td>
                          <td className="text-center p-2">{r.v}</td>
                          <td className="text-center p-2">{r.e}</td>
                          <td className="text-center p-2">{r.d}</td>
                          <td className="text-center p-2">{r.sg > 0 ? `+${r.sg}` : r.sg}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
