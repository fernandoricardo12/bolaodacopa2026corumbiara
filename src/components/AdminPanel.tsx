import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Team = { id: string; name: string; flag: string; group_name: string };
type Match = { id: string; home_team_id: string; away_team_id: string; kickoff: string; group_name: string | null; stage: string; venue: string | null; home_score: number | null; away_score: number | null; finished: boolean };
type Payment = { id: string; user_id: string; amount: number; status: string; created_at: string; proof_note: string | null };
type Profile = { id: string; display_name: string };

export function AdminPanel() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  // create match form
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [stage, setStage] = useState("group");
  const [groupName, setGroupName] = useState("");
  const [venue, setVenue] = useState("");

  async function load() {
    const [{ data: t }, { data: m }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from("teams").select("id,name,flag,group_name").order("group_name").order("name"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,display_name"),
    ]);
    if (t) setTeams(t);
    if (m) setMatches(m as Match[]);
    if (p) setPayments(p as Payment[]);
    if (pr) setProfiles(Object.fromEntries(pr.map((x) => [x.id, x])));
  }

  useEffect(() => { load(); }, []);

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!home || !away || !kickoff) return toast.error("Preencha os campos");
    if (home === away) return toast.error("Times devem ser diferentes");
    const { error } = await supabase.from("matches").insert({
      home_team_id: home,
      away_team_id: away,
      kickoff: new Date(kickoff).toISOString(),
      stage: stage as any,
      group_name: groupName || null,
      venue: venue || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Jogo cadastrado"); setHome(""); setAway(""); setKickoff(""); setVenue(""); load(); }
  }

  async function setScore(matchId: string, h: number, a: number, finish: boolean) {
    const { error } = await supabase.from("matches").update({
      home_score: h, away_score: a, finished: finish,
    }).eq("id", matchId);
    if (error) toast.error(error.message); else { toast.success(finish ? "Resultado lançado e pontos calculados" : "Placar salvo"); load(); }
  }

  async function confirmPayment(id: string, status: "confirmed" | "rejected") {
    const { error } = await supabase.from("payments").update({
      status, confirmed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Atualizado"); load(); }
  }

  return (
    <Tabs defaultValue="matches" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="matches">Jogos</TabsTrigger>
        <TabsTrigger value="results">Resultados</TabsTrigger>
        <TabsTrigger value="payments">Pagamentos</TabsTrigger>
      </TabsList>

      <TabsContent value="matches" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Novo jogo</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createMatch} className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Mandante</Label>
                <Select value={home} onValueChange={setHome}>
                  <SelectTrigger><SelectValue placeholder="Time" /></SelectTrigger>
                  <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.flag} {t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Visitante</Label>
                <Select value={away} onValueChange={setAway}>
                  <SelectTrigger><SelectValue placeholder="Time" /></SelectTrigger>
                  <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.flag} {t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data/hora</Label>
                <Input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fase</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">Grupos</SelectItem>
                    <SelectItem value="r32">16-avos</SelectItem>
                    <SelectItem value="r16">Oitavas</SelectItem>
                    <SelectItem value="qf">Quartas</SelectItem>
                    <SelectItem value="sf">Semi</SelectItem>
                    <SelectItem value="third">3º lugar</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Grupo</Label>
                <Input placeholder="A, B, C..." value={groupName} onChange={(e) => setGroupName(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <Label>Estádio</Label>
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
              </div>
              <Button type="submit" className="col-span-2">Cadastrar jogo</Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="results" className="space-y-2">
        {matches.map((m) => (
          <ResultRow key={m.id} m={m} teamMap={teamMap} onSet={setScore} />
        ))}
      </TabsContent>

      <TabsContent value="payments" className="space-y-2">
        {payments.length === 0 && <p className="text-sm text-muted-foreground">Sem pagamentos.</p>}
        {payments.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{profiles[p.user_id]?.display_name ?? "Usuário"}</div>
                <div className="text-sm">R$ {Number(p.amount).toFixed(2)} — <span className="text-muted-foreground">{p.status}</span></div>
                {p.proof_note && <div className="text-xs text-muted-foreground mt-1">{p.proof_note}</div>}
                <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</div>
              </div>
              {p.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => confirmPayment(p.id, "confirmed")}>Confirmar</Button>
                  <Button size="sm" variant="destructive" onClick={() => confirmPayment(p.id, "rejected")}>Rejeitar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function ResultRow({ m, teamMap, onSet }: { m: Match; teamMap: Record<string, Team>; onSet: (id: string, h: number, a: number, finish: boolean) => void }) {
  const [h, setH] = useState(m.home_score?.toString() ?? "");
  const [a, setA] = useState(m.away_score?.toString() ?? "");
  const home = teamMap[m.home_team_id];
  const away = teamMap[m.away_team_id];
  if (!home || !away) return null;
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        <div className="flex-1 text-sm">
          <div>{home.flag} {home.name} <span className="text-muted-foreground">×</span> {away.flag} {away.name}</div>
          <div className="text-xs text-muted-foreground">{new Date(m.kickoff).toLocaleString("pt-BR")} {m.finished && "• Encerrado"}</div>
        </div>
        <Input className="w-14" type="number" min={0} value={h} onChange={(e) => setH(e.target.value)} />
        <span>×</span>
        <Input className="w-14" type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => onSet(m.id, parseInt(h) || 0, parseInt(a) || 0, false)}>Salvar</Button>
        <Button size="sm" onClick={() => onSet(m.id, parseInt(h) || 0, parseInt(a) || 0, true)}>Encerrar</Button>
      </CardContent>
    </Card>
  );
}
