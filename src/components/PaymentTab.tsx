import { Component, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, MessageCircle, AlertTriangle } from "lucide-react";
import { useSettings } from "@/lib/useSettings";
import { ContactInfoCard } from "@/components/ContactInfoCard";

type Payment = { id: string; amount: number; status: string; mode: string; proof_note: string | null; created_at: string };

/** Boundary local — evita que um erro dentro da aba mostre "página não encontrada" no app inteiro. */
class PaymentBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[PaymentTab] erro de render:", error); }
  reset = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Não consegui carregar a tela de pagamento
          </CardTitle>
          <CardDescription>Tente recarregar. Se persistir, fale com o administrador no WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground break-all">{String(this.state.error?.message ?? this.state.error)}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={this.reset}>Tentar novamente</Button>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Recarregar página</Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}

export function PaymentTab(props: { userId: string; email?: string }) {
  return (
    <PaymentBoundary>
      <div className="notranslate" translate="no" suppressHydrationWarning>
        <PaymentTabInner {...props} />
      </div>
    </PaymentBoundary>
  );
}

function PaymentTabInner({ userId, email }: { userId: string; email?: string }) {
  const { settings } = useSettings();
  const PIX_KEY = settings?.pix_key || "—";
  const rawPhone = (settings?.whatsapp_support_phone || "").replace(/\D/g, "");
  const supportPhone = rawPhone;
  const hasPhone = supportPhone.length >= 10;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  // Mostra apenas pagamentos do bolão de pontos (individuais agora pagam na aba de Individuais)
  const pointsPayments = payments.filter((p) => p.mode === "points");
  const pointsConfirmed = pointsPayments.some((p) => p.status === "confirmed");
  const pointsPending = pointsPayments.some((p) => p.status === "pending");
  const blocked = pointsConfirmed || pointsPending;

  async function load() {
    try {
      const { data } = await supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (data) setPayments(data as Payment[]);
    } catch (err) {
      console.error("[PaymentTab] load erro:", err);
    }
  }

  useEffect(() => {
    if (!userId) return;
    load();
    const ch = supabase.channel(`pay-rt-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function buildWhatsAppUrl() {
    const valor = parseFloat(amount || "0");
    const msg = encodeURIComponent(
      `Olá! Sou *${email ?? ""}*. Acabei de registrar um pagamento de R$ ${valor.toFixed(2)} (Bolão de pontos).${note ? " Obs: " + note : ""} Segue o comprovante em anexo.`
    );
    return `https://api.whatsapp.com/send?phone=${supportPhone}&text=${msg}`;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) {
      toast.error(pointsConfirmed
        ? "Você já tem um pagamento do bolão de pontos confirmado."
        : "Você já possui um registro pendente. Aguarde a análise do administrador.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("payments").insert({
      user_id: userId, amount: parseFloat(amount), mode: "points", proof_note: note || null,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Pagamento registrado! Agora envie o comprovante pelo WhatsApp.");
      setRegistered(true);
    }
  }

  function handleSendWhatsApp() {
    if (!hasPhone) {
      toast.error("WhatsApp do administrador ainda não foi cadastrado.");
      return;
    }
    const url = buildWhatsAppUrl();
    try {
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = url;
    } catch {
      window.location.href = url;
    }
  }

  return (
    <div className="notranslate space-y-4" translate="no" suppressHydrationWarning>
      <ContactInfoCard userId={userId} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pagamento do Bolão (R$ 50) {pointsConfirmed && <Badge className="bg-emerald-600">Pago</Badge>}
          </CardTitle>
          <CardDescription>
            Pagamento único de R$ 50 para entrar no ranking acumulado da Copa. Os palpites individuais (R$ 5) são pagos diretamente na aba <strong>Individuais</strong>, após registrar cada palpite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Chave PIX</p>
            <p className="font-mono text-sm break-all">{PIX_KEY}</p>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => { navigator.clipboard?.writeText(PIX_KEY).then(() => toast.success("Chave copiada")).catch(() => toast.error("Não foi possível copiar")); }}>Copiar chave</Button>
          </div>

          <form onSubmit={handleRegister} className="space-y-3">
            {blocked && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                {pointsConfirmed
                  ? "✅ Seu pagamento do bolão de pontos já foi confirmado. Não é necessário registrar novamente."
                  : "⏳ Você já registrou um pagamento do bolão de pontos. Aguarde a análise do administrador. Caso seja recusado, você poderá registrar novamente."}
              </div>
            )}
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min={0} required value={amount} onChange={(e) => setAmount(e.target.value)} disabled={blocked} />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea placeholder="Ex: ID da transação" value={note} onChange={(e) => setNote(e.target.value)} disabled={blocked} />
            </div>

            {!hasPhone && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
                ⚠️ O administrador ainda não cadastrou o número de WhatsApp para envio do comprovante. Peça ao admin para configurar em <strong>Configurações → WhatsApp de suporte</strong>.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button type="submit" disabled={loading || blocked} variant="outline" className="w-full">
                {loading ? "Registrando…" : registered ? "✓ Registrado" : "1. Registrar pagamento"}
              </Button>
              <Button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={!hasPhone || blocked}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4 mr-2" /> 2. Enviar comprovante
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Primeiro registre o pagamento, depois clique para abrir o WhatsApp e anexar o comprovante.
            </p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Meus envios (Bolão de pontos)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {pointsPayments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum envio.</p>}
          {pointsPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">R$ {Number(p.amount).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</div>
                {p.proof_note && <div className="text-xs text-muted-foreground mt-1">{p.proof_note}</div>}
              </div>
              {p.status === "confirmed" && <Badge className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1"/> Confirmado</Badge>}
              {p.status === "pending" && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1"/> Pendente</Badge>}
              {p.status === "rejected" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/> Rejeitado</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
