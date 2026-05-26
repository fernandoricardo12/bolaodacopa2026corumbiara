import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trophy, DollarSign, Users, Activity, RefreshCw } from "lucide-react";

type Team = { id: string; name: string; flag: string; group_name: string };
type Match = { id: string; home_team_id: string; away_team_id: string; kickoff: string; group_name: string | null; stage: string; home_score: number | null; away_score: number | null; finished: boolean; external_match_id: string | null };
type Payment = { id: string; user_id: string; amount: number; status: string; mode: string; created_at: string; proof_note: string | null };
type Profile = { id: string; display_name: string };
type IBet = { id: string; user_id: string; match_id: string; home_score: number; away_score: number; amount: number; paid: boolean; payout: number };
type Bet = { id: string; user_id: string; match_id: string; points: number };

export function AdminPanel() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [ibets, setIbets] = useState<IBet[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const [t, m, p, pr, ib, b] = await Promise.all([
      supabase.from("teams").select("id,name,flag,group_name").order("name"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,display_name"),
      supabase.from("individual_bets").select("*"),
      supabase.from("bets").select("id,user_id,match_id,points"),
    ]);
    if (t.data) setTeams(t.data);
    if (m.data) setMatches(m.data as Match[]);
    if (p.data) setPayments(p.data as Payment[]);
    if (pr.data) setProfiles(Object.fromEntries(pr.data.map((x) => [x.id, x])));
    if (ib.data) setIbets(ib.data as IBet[]);
    if (b.data) setBets(b.data as Bet[]);
  }
  useEffect(() => { load(); }, []);

  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  // === Dashboard analytics ===
  const totalApostadoPontos = useMemo(
    () => payments.filter((p) => p.mode === "points" && p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0),
    [payments]
  );
  const totalApostadoIndividual = useMemo(
    () => ibets.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0),
    [ibets]
  );
  const totalAPagar = useMemo(
    () => ibets.filter((b) => Number(b.payout) > 0).reduce((s, b) => s + Number(b.payout), 0),
    [ibets]
  );
  const usuariosUnicos = useMemo(() => new Set([...bets.map((b) => b.user_id), ...ibets.map((b) => b.user_id)]).size, [bets, ibets]);
  const jogosEncerrados = matches.filter((m) => m.finished).length;

  const rankingPontos = useMemo(() => {
    const map: Record<string, number> = {};
    bets.forEach((b) => { map[b.user_id] = (map[b.user_id] ?? 0) + (b.points ?? 0); });
    return Object.entries(map)
      .map(([uid, pts]) => ({ user: profiles[uid]?.display_name ?? "—", pontos: pts, user_id: uid }))
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 10);
  }, [bets, profiles]);

  const ganhadoresIndividual = useMemo(
    () => ibets
      .filter((b) => Number(b.payout) > 0)
      .map((b) => {
        const m = matches.find((x) => x.id === b.match_id);
        const h = m ? teamMap[m.home_team_id] : null;
        const a = m ? teamMap[m.away_team_id] : null;
        return { ...b, matchLabel: h && a ? `${h.flag} ${h.name} ${m?.home_score}×${m?.away_score} ${a.name} ${a.flag}` : "—", userName: profiles[b.user_id]?.display_name ?? "—" };
      })
      .sort((a, b) => Number(b.payout) - Number(a.payout)),
    [ibets, matches, teamMap, profiles]
  );

  async function setExternalId(id: string, ext: string) {
    const { error } = await supabase.from("matches").update({ external_match_id: ext || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("ID salvo"); load(); }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const r = await fetch("/api/public/sync-scores", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success(`Sincronização: ${j.updated ?? 0}/${j.total ?? 0} atualizados`); load(); }
      else toast.error(j.error ?? "Falha");
    } finally { setSyncing(false); }
  }

  async function confirmPayment(id: string, status: "confirmed" | "rejected") {
    const { error } = await supabase.from("payments").update({ status, confirmed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Atualizado"); load(); }
  }

  async function toggleIbetPaid(b: IBet) {
    const { error } = await supabase.from("individual_bets").update({ paid: !b.paid }).eq("id", b.id);
    if (error) toast.error(error.message); else { toast.success(b.paid ? "Desmarcado" : "Pago confirmado"); load(); }
  }

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="jogos">Jogos (auto)</TabsTrigger>
        <TabsTrigger value="payments">Pagamentos</TabsTrigger>
        <TabsTrigger value="ibets">A pagar</TabsTrigger>
      </TabsList>

      {/* ============== DASHBOARD ============== */}
      <TabsContent value="dashboard" className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total arrecadado (pontos)" value={`R$ ${totalApostadoPontos.toFixed(2)}`} tone="emerald" />
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total arrecadado (individual)" value={`R$ ${totalApostadoIndividual.toFixed(2)}`} tone="blue" />
          <StatCard icon={<Trophy className="h-4 w-4" />} label="Total a pagar (ganhadores)" value={`R$ ${totalAPagar.toFixed(2)}`} tone="amber" />
          <StatCard icon={<Users className="h-4 w-4" />} label="Apostadores únicos" value={usuariosUnicos.toString()} tone="violet" />
          <StatCard icon={<Activity className="h-4 w-4" />} label="Jogos encerrados" value={`${jogosEncerrados} / ${matches.length}`} tone="slate" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">🏆 Top 10 — Ranking por pontos</CardTitle></CardHeader>
          <CardContent>
            {rankingPontos.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados ainda.</p> : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingPontos} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="user" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="pontos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center justify-between">
            <span>💰 Ganhadores individuais — pagamentos pendentes</span>
            <Badge variant="outline">{ganhadoresIndividual.length}</Badge>
          </CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ganhadoresIndividual.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ganhador apurado ainda.</p>}
            {ganhadoresIndividual.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 p-2 rounded border bg-card">
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">{g.userName} <span className="text-muted-foreground">— palpitou {g.home_score}×{g.away_score}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{g.matchLabel}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-emerald-600">R$ {Number(g.payout).toFixed(2)}</div>
                  <Badge variant={g.paid ? "secondary" : "default"} className="text-[10px]">{g.paid ? "pago" : "pendente"}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ============== JOGOS (apenas leitura + ID externo) ============== */}
      <TabsContent value="jogos" className="space-y-3">
        <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
          <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <div className="font-medium">🔄 Sistema 100% automático</div>
              <div className="text-xs text-muted-foreground">Os placares são atualizados a cada 2 minutos pela API. Cole o ID do jogo (eventid da RapidAPI) abaixo para ativar a sincronização.</div>
            </div>
            <Button size="sm" onClick={syncNow} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar agora"}
            </Button>
          </CardContent>
        </Card>
        {matches.map((m) => {
          const home = teamMap[m.home_team_id]; const away = teamMap[m.away_team_id];
          if (!home || !away) return null;
          return <MatchReadOnlyRow key={m.id} m={m} home={home} away={away} onSetExternal={setExternalId} />;
        })}
      </TabsContent>

      {/* ============== PAGAMENTOS DE ENTRADA ============== */}
      <TabsContent value="payments" className="space-y-2">
        {payments.length === 0 && <p className="text-sm text-muted-foreground">Sem pagamentos.</p>}
        {payments.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-medium truncate">{profiles[p.user_id]?.display_name ?? "Usuário"}</div>
                <div className="text-sm flex items-center gap-2 flex-wrap">R$ {Number(p.amount).toFixed(2)}
                  <Badge variant="outline" className="text-[10px]">{p.mode === "individual" ? "Individual" : "Pontos"}</Badge>
                  <span className="text-muted-foreground">{p.status}</span>
                </div>
                {p.proof_note && <div className="text-xs text-muted-foreground mt-1 break-all">{p.proof_note}</div>}
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

      {/* ============== A PAGAR (palpites individuais) ============== */}
      <TabsContent value="ibets" className="space-y-2">
        <p className="text-xs text-muted-foreground">Marque quando você efetuar o pagamento do prêmio ao ganhador.</p>
        {ibets.filter((b) => Number(b.payout) > 0).length === 0 && <p className="text-sm text-muted-foreground">Nenhum pagamento pendente.</p>}
        {ibets.filter((b) => Number(b.payout) > 0).map((b) => {
          const m = matches.find((x) => x.id === b.match_id);
          const h = m ? teamMap[m.home_team_id] : null;
          const a = m ? teamMap[m.away_team_id] : null;
          return (
            <Card key={b.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">{profiles[b.user_id]?.display_name ?? "Usuário"} — palpite {b.home_score}×{b.away_score}</div>
                  <div className="text-xs text-muted-foreground truncate">{h?.flag} {h?.name} × {a?.name} {a?.flag}</div>
                  <div className="text-sm font-bold text-emerald-600 mt-1">Pagar: R$ {Number(b.payout).toFixed(2)}</div>
                </div>
                <Button size="sm" variant={b.paid ? "secondary" : "default"} onClick={() => toggleIbetPaid(b)}>{b.paid ? "Pago ✓" : "Confirmar pagamento"}</Button>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>
    </Tabs>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
    amber: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
    violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
    slate: "bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300",
  };
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${tones[tone]}`}>{icon}{label}</div>
        <div className="text-xl font-bold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

function MatchReadOnlyRow({ m, home, away, onSetExternal }: { m: Match; home: Team; away: Team; onSetExternal: (id: string, ext: string) => void }) {
  const [ext, setExt] = useState(m.external_match_id ?? "");
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm min-w-0">
            <div className="font-medium truncate">{home.flag} {home.name} <span className="text-muted-foreground">×</span> {away.name} {away.flag}</div>
            <div className="text-xs text-muted-foreground">{new Date(m.kickoff).toLocaleString("pt-BR")}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {m.home_score !== null && m.away_score !== null && (
              <div className="text-lg font-bold tabular-nums">{m.home_score} × {m.away_score}</div>
            )}
            {m.finished ? <Badge variant="secondary">Encerrado</Badge> : m.external_match_id ? <Badge className="bg-emerald-600">🔄 auto</Badge> : <Badge variant="outline">aguardando</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">ID API:</Label>
          <Input className="h-7 text-xs flex-1" placeholder="eventid da RapidAPI (ex: 1234567)" value={ext} onChange={(e) => setExt(e.target.value)} onBlur={() => { if (ext !== (m.external_match_id ?? "")) onSetExternal(m.id, ext); }} />
        </div>
      </CardContent>
    </Card>
  );
}
