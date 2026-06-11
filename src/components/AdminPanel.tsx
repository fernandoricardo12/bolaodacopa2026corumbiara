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
import { Trophy, DollarSign, Users, Activity, RefreshCw, FileDown, ImageDown, Settings as SettingsIcon, Crown, Trash2, UserX, Wallet, BarChart3, ListChecks, Flame, Star, MessageCircle, Send, Copy, AlarmClock, Coins } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, AppSettings } from "@/lib/useSettings";
import { buildWaLink, defaultWelcomeMessage, isValidBrPhone } from "@/lib/whatsapp";
import { calculatePointsPrize } from "@/lib/prizeRules";
import { ReminderBetsTab } from "@/components/ReminderBetsTab";


type Team = { id: string; name: string; flag: string; group_name: string };
type Match = { id: string; home_team_id: string; away_team_id: string; kickoff: string; group_name: string | null; stage: string; home_score: number | null; away_score: number | null; finished: boolean; external_match_id: string | null; featured: boolean; live_status_detail?: string | null };
type Payment = { id: string; user_id: string; amount: number; status: string; mode: string; created_at: string; proof_note: string | null };
type Profile = { id: string; display_name: string; phone?: string | null; pix_key?: string | null; whatsapp_confirmed_at?: string | null };
type IBet = { id: string; user_id: string; match_id: string; home_score: number; away_score: number; amount: number; paid: boolean; payout: number; payout_paid?: boolean; payout_paid_at?: string | null };
type Bet = { id: string; user_id: string; match_id: string; points: number; home_score: number; away_score: number };

function countsForPointsRanking(m?: Match) {
  if (!m || m.home_score === null || m.away_score === null) return false;
  if (m.finished) return true;
  if (new Date(m.kickoff).getTime() > Date.now()) return false;
  const status = (m.live_status_detail ?? "").trim().toLowerCase();
  return !["scheduled", "not started", "pre-game", "pre game"].includes(status);
}

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
      supabase.from("profiles").select("id,display_name,phone,pix_key,whatsapp_confirmed_at"),
      supabase.from("individual_bets").select("*"),
      supabase.from("bets").select("id,user_id,match_id,points,home_score,away_score"),
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
  const pointsPrize = useMemo(() => calculatePointsPrize(totalApostadoPontos), [totalApostadoPontos]);
  const bolaoPontos80 = pointsPrize.poolPrize;       // 80% do arrecadado confirmado
  const taxaAdminPontos = pointsPrize.adminFee;      // 20% bruto
  const premioFinalPontos = pointsPrize.finalPrize;  // o que o líder leva

  const usuariosUnicos = useMemo(() => new Set([...bets.map((b) => b.user_id), ...ibets.map((b) => b.user_id)]).size, [bets, ibets]);
  const jogosEncerrados = matches.filter((m) => m.finished).length;

  const rankingPontos = useMemo(() => {
    const matchMap = Object.fromEntries(matches.map((m) => [m.id, m]));
    const confirmedUsers = new Set(payments.filter((p) => p.mode === "points" && p.status === "confirmed").map((p) => p.user_id));
    const pendingUsers = new Set(payments.filter((p) => p.mode === "points" && p.status === "pending").map((p) => p.user_id));
    const users = new Set([...Object.keys(profiles), ...bets.map((b) => b.user_id), ...payments.filter((p) => p.mode === "points").map((p) => p.user_id)]);

    return Array.from(users)
      .map((uid) => {
        const userBets = bets.filter((b) => b.user_id === uid);
        const validBets = userBets.filter((b) => countsForPointsRanking(matchMap[b.match_id]));
        const pontos = validBets.reduce((sum, b) => sum + (b.points ?? 0), 0);
        const status = confirmedUsers.has(uid) ? "confirmed" : pendingUsers.has(uid) ? "pending" : "none";
        return {
          user: profiles[uid]?.display_name ?? "—",
          pontos: status === "confirmed" ? pontos : 0,
          pontosPendentes: status === "confirmed" ? 0 : pontos,
          palpites: userBets.length,
          jogosPontuados: validBets.filter((b) => (b.points ?? 0) > 0).length,
          status,
          user_id: uid,
        };
      })
      .sort((a, b) => b.pontos - a.pontos || a.user.localeCompare(b.user, "pt-BR") || b.pontosPendentes - a.pontosPendentes || b.palpites - a.palpites);
  }, [bets, matches, payments, profiles]);

  const liderPontos = rankingPontos.find((r) => r.status === "confirmed" && r.pontos > 0) ?? rankingPontos.find((r) => r.status === "confirmed");

  const ganhadoresIndividual = useMemo(
    () => ibets
      .filter((b) => Number(b.payout) > 0)
      .map((b) => {
        const m = matches.find((x) => x.id === b.match_id);
        const h = m ? teamMap[m.home_team_id] : null;
        const a = m ? teamMap[m.away_team_id] : null;
        const isExact = !!m && b.home_score === m.home_score && b.away_score === m.away_score;
        return { ...b, matchLabel: h && a ? `${h.flag} ${h.name} ${m?.home_score}×${m?.away_score} ${a.name} ${a.flag}` : "—", userName: profiles[b.user_id]?.display_name ?? "—", prizeRule: isExact ? "Placar exato · 80%" : "Só vencedor · 60%" };
      })
      .sort((a, b) => Number(b.payout) - Number(a.payout)),
    [ibets, matches, teamMap, profiles]
  );

  // Lucro do administrador
  const totalPagoIndividual = useMemo(
    () => ibets.filter((b) => b.paid).reduce((s, b) => s + Number(b.payout || 0), 0),
    [ibets]
  );
  const sobraIndividual = Math.max(0, totalApostadoIndividual - totalPagoIndividual);
  // Lucro líquido do admin: taxa de 20% sobre pontos − bônus prometido + sobra dos individuais
  const lucroAdmin = taxaAdminPontos - pointsPrize.bonus + sobraIndividual;


  // Destaques de participantes (com base em jogos finalizados)
  const destaques = useMemo(() => {
    const finishedMatchIds = new Set(matches.filter((m) => m.finished).map((m) => m.id));
    const confirmedUsers = new Set(payments.filter((p) => p.mode === "points" && p.status === "confirmed").map((p) => p.user_id));

    // Pontos por usuário (bolão de pontos)
    const stats: Record<string, { name: string; pts: number; total: number; hits: number; exact: number; iwins: number; iCount: number }> = {};
    const ensure = (uid: string) => {
      stats[uid] ??= { name: profiles[uid]?.display_name ?? "—", pts: 0, total: 0, hits: 0, exact: 0, iwins: 0, iCount: 0 };
      return stats[uid];
    };

    for (const b of bets) {
      if (!finishedMatchIds.has(b.match_id)) continue;
      if (!confirmedUsers.has(b.user_id)) continue;
      const s = ensure(b.user_id);
      s.pts += b.points || 0;
      s.total += 1;
      if (b.points > 0) s.hits += 1;
      if (b.points === 20) s.exact += 1;
    }
    for (const ib of ibets) {
      if (!finishedMatchIds.has(ib.match_id) || !ib.paid) continue;
      const s = ensure(ib.user_id);
      s.iCount += 1;
      if (Number(ib.payout) > 0) s.iwins += 1;
    }

    const arr = Object.entries(stats).map(([uid, v]) => ({ uid, ...v, rate: v.total > 0 ? v.hits / v.total : 0 }));

    const topPontos = [...arr].filter((x) => x.total > 0).sort((a, b) => b.pts - a.pts)[0];
    const bolaMurcha = [...arr].filter((x) => x.total >= 3).sort((a, b) => a.pts - b.pts)[0];
    const sabeTudo = [...arr].filter((x) => x.exact > 0).sort((a, b) => b.exact - a.exact || b.pts - a.pts)[0];
    const altoIndice = [...arr].filter((x) => x.total >= 3).sort((a, b) => b.rate - a.rate || b.pts - a.pts)[0];
    const topIndividual = [...arr].filter((x) => x.iCount > 0).sort((a, b) => b.iwins - a.iwins || b.iCount - a.iCount)[0];

    return { topPontos, topIndividual, bolaMurcha, sabeTudo, altoIndice };
  }, [bets, ibets, matches, payments, profiles]);


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
    const { data, error } = await (supabase as any).rpc("admin_set_payment_status", {
      _payment_id: id,
      _status: status,
    });
    if (error) { toast.error(error.message); return; }

    const result = Array.isArray(data) ? data[0] : data;
    if (status === "confirmed" && result?.marked_bets > 0) {
      toast.success(`Pagamento confirmado · ${result.marked_bets} palpite(s) pago(s) · bolo +R$ ${Number(result.credited_amount ?? 0).toFixed(2)}`);
    } else if (status === "confirmed" && result?.unapplied_amount > 0) {
      toast.warning("Pagamento confirmado, mas não havia palpites pendentes suficientes para usar todo o valor.");
    } else {
      toast.success(status === "confirmed" ? "Pagamento confirmado" : "Pagamento rejeitado");
    }
    load();
  }

  async function togglePayoutPaid(b: IBet) {
    const nextPaid = !b.payout_paid;
    const { error } = await (supabase as any)
      .from("individual_bets")
      .update({ payout_paid: nextPaid, payout_paid_at: nextPaid ? new Date().toISOString() : null })
      .eq("id", b.id);
    if (error) toast.error(error.message); else { toast.success(nextPaid ? "Prêmio marcado como pago" : "Prêmio reaberto"); load(); }
  }

  async function deleteParticipant(userId: string, name: string) {
    const { error } = await supabase.rpc("admin_delete_participant", { _user_id: userId });
    if (error) toast.error(error.message);
    else { toast.success(`${name} foi excluído`); load(); }
  }

  async function toggleFeatured(m: Match) {
    const { error } = await supabase.from("matches").update({ featured: !m.featured }).eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success(m.featured ? "Destaque removido" : "Jogo em destaque! 🔥"); load(); }
  }

  async function exportImage() {
    if (!reportRef.current) return;
    toast.loading("Gerando imagem…", { id: "exp" });
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `bolao-relatorio-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagem salva", { id: "exp" });
    } catch (e: any) {
      console.error("export image", e);
      toast.error(`Erro: ${e?.message ?? "ao gerar imagem"}`, { id: "exp" });
    }
  }

  async function exportPDF() {
    if (!reportRef.current) return;
    toast.loading("Gerando PDF…", { id: "expp" });
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(img, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(img, "PNG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`bolao-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF salvo", { id: "expp" });
    } catch (e: any) {
      console.error("export pdf", e);
      toast.error(`Erro: ${e?.message ?? "ao gerar PDF"}`, { id: "expp" });
    }
  }

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList className="flex sm:grid sm:grid-cols-11 w-full overflow-x-auto sm:overflow-visible gap-1 p-1 h-auto">
        <TabsTrigger value="dashboard" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><BarChart3 className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Dashboard</span></TabsTrigger>
        <TabsTrigger value="jogos" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Activity className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Jogos</span></TabsTrigger>
        <TabsTrigger value="destaques" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Flame className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Destaques</span></TabsTrigger>
        <TabsTrigger value="palpites" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><ListChecks className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Bolão</span></TabsTrigger>
        <TabsTrigger value="ipalpites" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Coins className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Individuais</span></TabsTrigger>
        <TabsTrigger value="lembretes" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><AlarmClock className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Lembretes</span></TabsTrigger>
        <TabsTrigger value="payments" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><DollarSign className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Pagamentos</span></TabsTrigger>
        <TabsTrigger value="ibets" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Wallet className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">A pagar</span></TabsTrigger>
        <TabsTrigger value="whatsapp" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><MessageCircle className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">WhatsApp</span></TabsTrigger>
        <TabsTrigger value="users" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><UserX className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Participantes</span></TabsTrigger>
        <TabsTrigger value="config" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><SettingsIcon className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Config</span></TabsTrigger>
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
                  <div className="text-xs uppercase opacity-90">Prêmio total ao líder (80% + bônus admin)</div>
                  <div className="text-3xl font-bold">R$ {premioFinalPontos.toFixed(2)}</div>
                  <div className="text-xs opacity-90">
                    Líder atual: <strong>{liderPontos?.user ?? "—"}</strong>
                    {liderPontos ? ` (${liderPontos.pontos} pts)` : ""}
                  </div>
                  <div className="text-[11px] opacity-90 mt-1">
                    80% do bolo confirmado (R$ {bolaoPontos80.toFixed(2)}) + R$ {pointsPrize.bonus.toFixed(2)} de bônus do admin · Taxa admin bruta (20%): R$ {taxaAdminPontos.toFixed(2)}
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

          {/* Lucro do administrador */}
          <Card className="border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <DollarSign className="h-10 w-10 text-emerald-600" />
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs uppercase text-emerald-700 font-semibold">💼 Lucro do administrador</div>
                  <div className="text-3xl font-bold text-emerald-700">R$ {lucroAdmin.toFixed(2)}</div>
                  <div className="text-xs text-emerald-800/80 mt-1">
                    Taxa pontos (20%): <strong>R$ {taxaAdminPontos.toFixed(2)}</strong> − Bônus prometido ao líder: <strong>R$ {pointsPrize.bonus.toFixed(2)}</strong> + Sobra individual: <strong>R$ {sobraIndividual.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destaques de participantes */}
          <Card>
            <CardHeader><CardTitle className="text-base">⭐ Destaques dos participantes</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <HighlightCard
                emoji="🥇" title="Mestre dos pontos" tone="amber"
                name={destaques.topPontos?.name ?? "—"}
                detail={destaques.topPontos ? `${destaques.topPontos.pts} pts em ${destaques.topPontos.total} palpites` : "Sem dados"}
              />
              <HighlightCard
                emoji="💰" title="Rei do individual" tone="emerald"
                name={destaques.topIndividual?.name ?? "—"}
                detail={destaques.topIndividual ? `${destaques.topIndividual.iwins} prêmio(s) em ${destaques.topIndividual.iCount} apostas` : "Sem dados"}
              />
              <HighlightCard
                emoji="🎯" title="Sabe-tudo (placar exato)" tone="violet"
                name={destaques.sabeTudo?.name ?? "—"}
                detail={destaques.sabeTudo ? `${destaques.sabeTudo.exact} placar(es) exato(s)` : "Ninguém acertou ainda"}
              />
              <HighlightCard
                emoji="🔥" title="Alto índice de acerto" tone="blue"
                name={destaques.altoIndice?.name ?? "—"}
                detail={destaques.altoIndice ? `${(destaques.altoIndice.rate * 100).toFixed(0)}% (${destaques.altoIndice.hits}/${destaques.altoIndice.total})` : "Sem dados"}
              />
              <HighlightCard
                emoji="🎈" title="Bola murcha" tone="slate"
                name={destaques.bolaMurcha?.name ?? "—"}
                detail={destaques.bolaMurcha ? `Apenas ${destaques.bolaMurcha.pts} pts em ${destaques.bolaMurcha.total} palpites` : "Sem dados"}
              />
            </CardContent>
          </Card>


          <Card>
            <CardHeader><CardTitle className="text-base">🏆 Ranking completo — Bolão de pontos</CardTitle></CardHeader>
            <CardContent>
              {rankingPontos.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados ainda.</p> : (
                <>
                  <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-900 dark:text-amber-100">
                    Ranking oficial soma apenas jogos com placar válido e somente participantes com pagamento do bolão confirmado. Pagamentos pendentes aparecem separados.
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingPontos.filter((r) => r.status === "confirmed").slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
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
                      <div key={r.user_id} className={`flex justify-between items-center gap-2 p-2 text-sm ${i === 0 && r.status === "confirmed" ? "bg-yellow-50 font-bold" : ""}`}>
                        <div className="min-w-0">
                          <span className="truncate block">{r.status === "confirmed" ? `${i + 1}º ` : "— "}{i === 0 && r.status === "confirmed" ? "👑 " : ""}{r.user}</span>
                          <div className="text-[10px] text-muted-foreground">
                            {r.palpites} palpite(s) · {r.jogosPontuados} jogo(s) pontuando
                          </div>
                        </div>
                        <span className="flex items-center gap-2 shrink-0">
                          <Badge variant={r.status === "confirmed" ? "secondary" : r.status === "pending" ? "outline" : "destructive"} className="text-[10px]">
                            {r.status === "confirmed" ? "confirmado" : r.status === "pending" ? "pendente" : "sem pagamento"}
                          </Badge>
                          <span className="tabular-nums font-bold">{r.pontos} pts</span>
                          {r.pontosPendentes > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">({r.pontosPendentes} pend.)</span>}
                        </span>
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
                    <Badge variant="outline" className="text-[10px] mt-1">{g.prizeRule}</Badge>
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

      {/* ============== DESTAQUES (jogo top da rodada) ============== */}
      <TabsContent value="destaques" className="space-y-3">
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-300">
          <CardContent className="p-3 text-xs flex items-start gap-2">
            <Flame className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              Marque jogos como <strong>"Jogo Top da Rodada"</strong> para liberá-los na aba <strong>Individual</strong>. Só jogos destaque aceitam palpites individuais (R$ 2 ou R$ 5 por palpite).
              Use o campo <strong>Bônus extra</strong> para adicionar prêmio (ex.: R$ 50) — esse bônus é pago apenas a quem apostou <strong>R$ 5</strong> e cravou o placar exato.
            </div>
          </CardContent>
        </Card>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-yellow-500" />
          {matches.filter((m) => m.featured).length} jogo(s) em destaque de {matches.length} total
        </div>
        {matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhum jogo cadastrado.</p>}
        {matches.map((m) => {
          const home = teamMap[m.home_team_id]; const away = teamMap[m.away_team_id];
          if (!home || !away) return null;
          const matchIbets = ibets.filter((b) => b.match_id === m.id);
          const paidPool = matchIbets.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0);
          return (
            <Card key={m.id} className={m.featured ? "border-2 border-yellow-400 shadow" : ""}>
              <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-2">
                    {m.featured && <Flame className="h-4 w-4 text-amber-500 shrink-0" />}
                    {home.flag} {home.name} <span className="text-muted-foreground">×</span> {away.name} {away.flag}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.kickoff).toLocaleString("pt-BR")} · {matchIbets.length} palpite(s) · bolo R$ {paidPool.toFixed(2)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={m.featured ? "default" : "outline"}
                  onClick={() => toggleFeatured(m)}
                  disabled={m.finished}
                  className={m.featured ? "bg-yellow-500 hover:bg-yellow-600 text-yellow-950" : ""}
                >
                  {m.featured ? <><Star className="h-4 w-4 mr-1 fill-current" /> Em destaque</> : <><Flame className="h-4 w-4 mr-1" /> Destacar jogo</>}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>


      {/* ============== PALPITES DO BOLÃO DE PONTOS ============== */}
      <TabsContent value="palpites" className="space-y-3">
        <Card className="bg-slate-50 dark:bg-slate-900/40">
          <CardContent className="p-3 text-xs text-muted-foreground">
            Visão completa de todos os palpites do <strong>bolão de pontos</strong> por jogo.
          </CardContent>
        </Card>
        {matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhum jogo cadastrado.</p>}
        {matches.map((m) => {
          const home = teamMap[m.home_team_id]; const away = teamMap[m.away_team_id];
          if (!home || !away) return null;
          const matchBets = bets.filter((b) => b.match_id === m.id);

          return (
            <Card key={m.id}>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                  <span className="truncate">{home.flag} {home.name} <span className="text-muted-foreground">×</span> {away.name} {away.flag}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {m.home_score !== null && m.away_score !== null && (
                      <span className="font-bold tabular-nums">{m.home_score}×{m.away_score}</span>
                    )}
                    {m.finished ? <Badge variant="secondary" className="text-[10px]">Encerrado</Badge> : <Badge variant="outline" className="text-[10px]">{new Date(m.kickoff).toLocaleString("pt-BR")}</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1">🏆 Bolão de pontos ({matchBets.length})</div>
                {matchBets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum palpite.</p>
                ) : (
                  <div className="divide-y border rounded">
                    {matchBets.map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                        <span className="font-medium truncate">{profiles[b.user_id]?.display_name ?? "—"}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="tabular-nums font-bold">{b.home_score}×{b.away_score}</span>
                          {m.finished && <Badge variant="secondary" className="text-[9px]">{b.points} pts</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      {/* ============== PALPITES INDIVIDUAIS ============== */}
      <TabsContent value="ipalpites" className="space-y-3">
        <Card className="bg-slate-50 dark:bg-slate-900/40">
          <CardContent className="p-3 text-xs text-muted-foreground">
            Visão completa de todos os <strong>palpites individuais</strong> (R$ 2 por palpite) por jogo.
          </CardContent>
        </Card>
        {matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhum jogo cadastrado.</p>}
        {matches.map((m) => {
          const home = teamMap[m.home_team_id]; const away = teamMap[m.away_team_id];
          if (!home || !away) return null;
          const matchIbets = ibets.filter((b) => b.match_id === m.id);

          return (
            <Card key={m.id}>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                  <span className="truncate">{home.flag} {home.name} <span className="text-muted-foreground">×</span> {away.name} {away.flag}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {m.home_score !== null && m.away_score !== null && (
                      <span className="font-bold tabular-nums">{m.home_score}×{m.away_score}</span>
                    )}
                    {m.finished ? <Badge variant="secondary" className="text-[10px]">Encerrado</Badge> : <Badge variant="outline" className="text-[10px]">{new Date(m.kickoff).toLocaleString("pt-BR")}</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1">💰 Palpites individuais ({matchIbets.length})</div>
                {matchIbets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum palpite individual.</p>
                ) : (
                  <div className="divide-y border rounded">
                    {matchIbets.map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                        <span className="font-medium truncate">{profiles[b.user_id]?.display_name ?? "—"}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="tabular-nums font-bold">{b.home_score}×{b.away_score}</span>
                          <Badge variant={b.paid ? "default" : "outline"} className="text-[9px]">{b.paid ? "pago" : "pendente"}</Badge>
                          {Number(b.payout) > 0 && <span className="text-emerald-600 font-semibold">R$ {Number(b.payout).toFixed(2)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
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
          const prizeRule = m && b.home_score === m.home_score && b.away_score === m.away_score ? "Placar exato · 80%" : "Só vencedor · 60%";
          return (
            <Card key={b.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">{profiles[b.user_id]?.display_name ?? "Usuário"} — palpite {b.home_score}×{b.away_score}</div>
                  <div className="text-xs text-muted-foreground truncate">{h?.flag} {h?.name} × {a?.name} {a?.flag}</div>
                  <div className="text-xs text-muted-foreground">{prizeRule}</div>
                  <div className="text-sm font-bold text-emerald-600 mt-1">Pagar: R$ {Number(b.payout).toFixed(2)}</div>
                </div>
                <Button size="sm" variant={b.payout_paid ? "secondary" : "default"} onClick={() => togglePayoutPaid(b)}>{b.payout_paid ? "Prêmio pago ✓" : "Marcar prêmio pago"}</Button>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      {/* ============== PARTICIPANTES ============== */}
      {/* ============== LEMBRETES ============== */}
      <TabsContent value="lembretes">
        <ReminderBetsTab />
      </TabsContent>

      {/* ============== WHATSAPP ============== */}
      <TabsContent value="whatsapp">
        <WhatsAppMessagesTab profiles={Object.values(profiles)} />
      </TabsContent>

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
                <div className="min-w-0 space-y-0.5">
                  <div className="font-medium truncate">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground">{totalPts} pts · {totalInd} palpites individuais</div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Tel: </span>
                    {p.phone ? (
                      <a href={buildWaLink(p.phone)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">{p.phone}</a>
                    ) : <span className="text-amber-600">não informado</span>}
                    {p.whatsapp_confirmed_at ? (
                      <Badge className="ml-2 bg-emerald-600 text-[10px]">WhatsApp ok</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700 dark:text-amber-300 text-[10px]">pendente</Badge>
                    )}

                  </div>
                  <div className="text-xs break-all">
                    <span className="text-muted-foreground">PIX: </span>
                    {p.pix_key ? (
                      <button type="button" onClick={() => { navigator.clipboard.writeText(p.pix_key!); toast.success("Chave PIX copiada"); }} className="font-mono text-foreground hover:underline">{p.pix_key}</button>
                    ) : <span className="text-amber-600">não informado</span>}
                  </div>
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

function WhatsAppMessagesTab({ profiles }: { profiles: Profile[] }) {
  const [message, setMessage] = useState(() => defaultWelcomeMessage());
  const withPhone = profiles.filter((p) => isValidBrPhone(p.phone));
  const pendingPhone = profiles.filter((p) => !isValidBrPhone(p.phone) || !p.whatsapp_confirmed_at);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" /> Mensagem padrão (boas-vindas + regras)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setMessage(defaultWelcomeMessage())}>
              <RefreshCw className="h-4 w-4 mr-1" /> Restaurar padrão
            </Button>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(message); toast.success("Mensagem copiada"); }}>
              <Copy className="h-4 w-4 mr-1" /> Copiar mensagem
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Edite à vontade antes de enviar. O WhatsApp abrirá com este texto já preenchido — basta apertar enviar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-600" /> Participantes com WhatsApp ({withPhone.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {withPhone.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum participante com WhatsApp cadastrado ainda.</p>
          )}
          {withPhone.map((p) => {
            const personalized = message.includes("Olá,") || message.includes("Olá!")
              ? defaultWelcomeMessage(p.display_name) === message
                ? defaultWelcomeMessage(p.display_name)
                : message.replace(/Olá[^\n]*/, `Olá, ${p.display_name.split(" ")[0]}! 👋`)
              : message;
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 border rounded-lg p-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{p.phone}</span>
                    {!p.whatsapp_confirmed_at && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-300">aguardando confirmação no login</Badge>}
                  </div>
                </div>
                <Button
                  size="sm"
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <a href={buildWaLink(p.phone!, personalized)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1" /> Abrir conversa
                  </a>
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {pendingPhone.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-700 dark:text-amber-300">
              ⚠️ WhatsApp pendente de cadastro/confirmação ({pendingPhone.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              Esses participantes serão obrigados a cadastrar ou confirmar o WhatsApp no próximo acesso.
            </p>
            {pendingPhone.map((p) => (
              <div key={p.id} className="text-sm border-l-2 border-amber-400 pl-2 py-1">
                {p.display_name}{isValidBrPhone(p.phone) ? ` — ${p.phone} (precisa confirmar)` : " — sem número válido"}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
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

function HighlightCard({ emoji, title, name, detail, tone }: { emoji: string; title: string; name: string; detail: string; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
    blue: "border-blue-300 bg-blue-50 dark:bg-blue-950/30",
    amber: "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
    violet: "border-violet-300 bg-violet-50 dark:bg-violet-950/30",
    slate: "border-slate-300 bg-slate-100 dark:bg-slate-800/50",
  };
  return (
    <div className={`rounded-lg border-2 p-3 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase opacity-80 flex items-center gap-1">
        <span className="text-base">{emoji}</span>{title}
      </div>
      <div className="text-base font-bold mt-1 truncate">{name}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
    </div>
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
