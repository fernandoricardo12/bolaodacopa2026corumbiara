import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Lock, Trophy } from "lucide-react";
import { FlagImg } from "@/lib/flags";
import { MatchFilters, filterMatches } from "@/components/MatchFilters";

type Team = { id: string; name: string; flag: string; code: string };
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
};
type Bet = { match_id: string; home_score: number; away_score: number; points: number };

export function MatchesTab({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [drafts, setDrafts] = useState<Record<string, { h: string; a: string }>>({});
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const visible = useMemo(() => filterMatches(matches, teams, search, group), [matches, teams, search, group]);

  async function load() {
    const [{ data: ts }, { data: ms }, { data: bs }] = await Promise.all([
      supabase.from("teams").select("id,name,flag,code"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("bets").select("match_id,home_score,away_score,points").eq("user_id", userId),
    ]);
    if (ts) setTeams(Object.fromEntries(ts.map((t) => [t.id, t])));
    if (ms) setMatches(ms as Match[]);
    if (bs) setBets(Object.fromEntries(bs.map((b) => [b.match_id, b as Bet])));
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("matches-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

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
    else {
      toast.success("Palpite excluído");
      setDrafts((p) => ({ ...p, [matchId]: { h: "", a: "" } }));
    }
  }

  return (
    <div className="space-y-3">
      <MatchFilters search={search} onSearch={setSearch} group={group} onGroup={setGroup} />
      {matches.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum jogo cadastrado ainda.</p>}
      {matches.length > 0 && visible.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum jogo encontrado com esses filtros.</p>}
      {visible.map((m) => {
        const home = teams[m.home_team_id];
        const away = teams[m.away_team_id];
        if (!home || !away) return null;
        const bet = bets[m.id];
        const locked = m.finished || new Date(m.kickoff) <= new Date();
        const d = drafts[m.id] ?? { h: bet?.home_score?.toString() ?? "", a: bet?.away_score?.toString() ?? "" };
        return (
          <Card key={m.id} className={locked ? "opacity-95" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex gap-2 items-center">
                  {m.group_name && <Badge variant="secondary">Grupo {m.group_name}</Badge>}
                  <Clock className="h-3 w-3" />
                  <span>{new Date(m.kickoff).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                {locked && <Lock className="h-3 w-3" />}
              </div>
              {m.venue && <p className="text-xs text-muted-foreground">{m.venue}</p>}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
                  <FlagImg code={home.code} name={home.name} size={40} />
                  <div className="text-xs sm:text-sm font-medium text-right truncate w-full">{home.name}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {m.finished ? (
                    <div className="text-2xl sm:text-3xl font-bold tabular-nums">{m.home_score}<span className="text-muted-foreground mx-1">×</span>{m.away_score}</div>
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
                    {m.finished && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-amber-500" /> {bet.points} pts
                      </span>
                    )}
                  </div>
                ) : <span className="text-xs text-muted-foreground">Sem palpite</span>}
                {!locked && (
                  <Button size="sm" onClick={() => saveBet(m.id)}>{bet ? "Atualizar" : "Palpitar"}</Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
