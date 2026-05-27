import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trophy, DollarSign, Users, Activity, RefreshCw, FileDown, ImageDown, Settings as SettingsIcon, Crown, Trash2, UserX } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSettings, AppSettings } from "@/lib/useSettings";

type Team = { id: string; name: string; flag: string; group_name: string };
type Match = { id: string; home_team_id: string; away_team_id: string; kickoff: string; group_name: string | null; stage: string; home_score: number | null; away_score: number | null; finished: boolean; external_match_id: string | null };
type Payment = { id: string; user_id: string; amount: number; status: string; mode: string; created_at: string; proof_note: string | null };
type Profile = { id: string; display_name: string };
type IBet = { id: string; user_id: string; match_id: string; home_score: number; away_score: number; amount: number; paid: boolean; payout: number };
type Bet = { id: string; user_id: string; match_id: string; points: number };

const POINTS_WINNER_SHARE = 0.80;

export function AdminPanel() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [ibets, setIbets] = useState<IBet[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [syncing, setSyncing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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
  const premioFinalPontos = totalApostadoPontos * POINTS_WINNER_SHARE;
  const taxaAdminPontos = totalApostadoPontos * (1 - POINTS_WINNER_SHARE);
  const usuariosUnicos = useMemo(() => new Set([...bets.map((b) => b.user_id), ...ibets.map((b) => b.user_id)]).size, [bets, ibets]);
  const jogosEncerrados = matches.filter((m) => m.finished).length;

  const rankingPontos = useMemo(() => {
    const map: Record<string, number> = {};
    bets.forEach((b) => { map[b.user_id] = (map[b.user_id] ?? 0) + (b.points ?? 0); });
    return Object.entries(map)
      .map(([uid, pts]) => ({ user: profiles[uid]?.display_name ?? "—", pontos: pts, user_id: uid }))
      .sort((a, b) => b.pontos - a.pontos);
  }, [bets, profiles]);

  const liderPontos = rankingPontos[0];

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

  async function deleteParticipant(userId: string, name: string) {
    const { error } = await supabase.rpc("admin_delete_participant", { _user_id: userId });
    if (error) toast.error(error.message);
    else { toast.success(`${name} foi excluído`); load(); }
  }

  async function exportImage() {
    if (!reportRef.current) return;
    toast.loading("Gerando imagem…", { id: "exp" });
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `bolao-relatorio-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagem salva", { id: "exp" });
    } catch (e) { toast.error("Erro ao gerar imagem", { id: "exp" }); }
  }

  async function exportPDF() {
    if (!reportRef.current) return;
    toast.loading("Gerando PDF…", { id: "expp" });
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save(`bolao-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF salvo", { id: "expp" });
    } catch (e) { toast.error("Erro ao gerar PDF", { id: "expp" }); }
  }

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="jogos">Jogos</TabsTrigger>
        <TabsTrigger value="payments">Pagamentos</TabsTrigger>
        <TabsTrigger value="ibets">A pagar</TabsTrigger>
        <TabsTrigger value="users"><UserX className="h-4 w-4 mr-1" />Participantes</TabsTrigger>
        <TabsTrigger value="config"><SettingsIcon className="h-4 w-4 mr-1" />Config</TabsTrigger>
      </TabsList>

      {/* ============== DASHBOARD ============== */}
      <TabsContent value="dashboard" className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={exportImage}>
            <ImageDown className="h-4 w-4 mr-1" /> Exportar imagem
          </Button>
          <Button size="sm" onClick={exportPDF} className="bg-emerald-600 hover:bg-emerald-700">
            <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
        </div>

        <div ref={reportRef} className="space-y-4 bg-white p-4 rounded-lg">
          <div className="text-center border-b-2 border-emerald-600 pb-3">
            <h2 className="text-2xl font-bold text-emerald-700">🏆 Bolão Copa 2026 — Relatório Oficial</h2>
            <p className="text-xs text-slate-600">Gerado em {new Date().toLocaleString("pt-BR")}</p>
          </div>

          <Card className="bg-gradient-to-r from-emerald-500 to-yellow-400 border-0 text-white shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Crown className="h-10 w-10" />
                <div className="flex-1">
                  <div className="text-xs uppercase opacity-90">Prêmio final do bolão de pontos (80%)</div>
                  <div className="text-3xl font-bold">R$ {premioFinalPontos.toFixed(2)}</div>
                  <div className="text-xs opacity-90">
                    Líder atual: <strong>{liderPontos?.user ?? "—"}</strong>
                    {liderPontos ? ` (${liderPontos.pontos} pts)` : ""} · Taxa admin (20%): R$ {taxaAdminPontos.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<DollarSign className="h-4 w-4" />} label="Arrecadado (pontos)" value={`R$ ${totalApostadoPontos.toFixed(2)}`} tone="emerald" />
            <StatCard icon={<DollarSign className="h-4 w-4" />} label="Arrecadado (individual)" value={`R$ ${totalApostadoIndividual.toFixed(2)}`} tone="blue" />
            <StatCard icon={<Trophy className="h-4 w-4" />} label="A pagar (ganhadores)" value={`R$ ${totalAPagar.toFixed(2)}`} tone="amber" />
            <StatCard icon={<Users className="h-4 w-4" />} label="Apostadores únicos" value={usuariosUnicos.toString()} tone="violet" />
            <StatCard icon={<Activity className="h-4 w-4" />} label="Jogos encerrados" value={`${jogosEncerrados} / ${matches.length}`} tone="slate" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">🏆 Ranking completo — Bolão de pontos</CardTitle></CardHeader>
            <CardContent>
              {rankingPontos.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados ainda.</p> : (
                <>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingPontos.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="user" width={110} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="pontos" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 divide-y border rounded">
                    {rankingPontos.map((r, i) => (
                      <div key={r.user_id} className={`flex justify-between items-center p-2 text-sm ${i === 0 ? "bg-yellow-50 font-bold" : ""}`}>
                        <span>{i + 1}º {i === 0 ? "👑 " : ""}{r.user}</span>
                        <span className="tabular-nums">{r.pontos} pts</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center justify-between">
              <span>💰 Divisão de prêmios — Palpites individuais</span>
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
        </div>
      </TabsContent>

      {/* ============== JOGOS ============== */}
      <TabsContent value="jogos" className="space-y-3">
        <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
          <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <div className="font-medium">🔄 Sistema 100% automático</div>
              <div className="text-xs text-muted-foreground">Placares atualizam a cada 2 minutos via API. Cole o ID do jogo (eventid RapidAPI) para ativar.</div>
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

      {/* ============== PAGAMENTOS ============== */}
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

      {/* ============== A PAGAR ============== */}
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

      {/* ============== PARTICIPANTES ============== */}
      <TabsContent value="users" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Exclui o participante e <strong>todos</strong> os dados dele (palpites, pagamentos, perfil). Útil para remover duplicatas ou redefinir o sistema. Esta ação é irreversível.
        </p>
        {Object.values(profiles).length === 0 && <p className="text-sm text-muted-foreground">Nenhum participante.</p>}
        {Object.values(profiles).map((p) => {
          const totalPts = bets.filter((b) => b.user_id === p.id).reduce((s, b) => s + (b.points ?? 0), 0);
          const totalInd = ibets.filter((b) => b.user_id === p.id).length;
          return (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground">{totalPts} pts · {totalInd} palpites individuais</div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {p.display_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vai apagar todos os palpites, pagamentos e o cadastro deste participante. Não dá pra desfazer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteParticipant(p.id, p.display_name)} className="bg-destructive">Excluir definitivamente</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      {/* ============== CONFIG ============== */}
      <TabsContent value="config">
        <ConfigPanel />
      </TabsContent>
    </Tabs>
  );
}

function ConfigPanel() {
  const { settings, reload } = useSettings();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  async function save() {
    setSaving(true);
    const updates = Object.entries(form).map(([key, value]) =>
      supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
    );
    const results = await Promise.all(updates);
    setSaving(false);
    const err = results.find((r) => r.error);
    if (err?.error) toast.error(err.error.message);
    else { toast.success("Configurações salvas"); reload(); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <SettingsIcon className="h-4 w-4" /> Configurações da plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Chave PIX para recebimento</Label>
          <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="email, CPF, telefone ou chave aleatória" />
        </div>
        <div className="space-y-1">
          <Label>Link do grupo do WhatsApp</Label>
          <Input value={form.whatsapp_group_url} onChange={(e) => setForm({ ...form, whatsapp_group_url: e.target.value })} placeholder="https://chat.whatsapp.com/..." />
          <p className="text-[11px] text-muted-foreground">Aparecerá como botão no rodapé para os apostadores entrarem no grupo.</p>
        </div>
        <div className="space-y-1">
          <Label>Telefone WhatsApp de suporte (com DDI)</Label>
          <Input value={form.whatsapp_support_phone} onChange={(e) => setForm({ ...form, whatsapp_support_phone: e.target.value })} placeholder="5569984236281" />
        </div>
        <div className="space-y-1">
          <Label>Texto informativo (aba Individual)</Label>
          <Input value={form.about_text} onChange={(e) => setForm({ ...form, about_text: e.target.value })} />
        </div>
        <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
          {saving ? "Salvando…" : "Salvar configurações"}
        </Button>
      </CardContent>
    </Card>
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
          <Input className="h-7 text-xs flex-1" placeholder="eventid da RapidAPI" value={ext} onChange={(e) => setExt(e.target.value)} onBlur={() => { if (ext !== (m.external_match_id ?? "")) onSetExternal(m.id, ext); }} />
        </div>
      </CardContent>
    </Card>
  );
}
