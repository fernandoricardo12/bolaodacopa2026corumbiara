import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, MessageCircle } from "lucide-react";
import { useSettings } from "@/lib/useSettings";


type Payment = { id: string; amount: number; status: string; mode: string; proof_note: string | null; created_at: string };
type IBet = { id: string; match_id: string; home_score: number; away_score: number; paid: boolean };

const PRICE_INDIVIDUAL = 10;

export function PaymentTab({ userId, email }: { userId: string; email?: string }) {
  const { settings } = useSettings();
  const PIX_KEY = settings.pix_key || "—";
  const rawPhone = (settings.whatsapp_support_phone || "").replace(/\D/g, "");
  const supportPhone = rawPhone;
  const hasPhone = supportPhone.length >= 10;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidBets, setUnpaidBets] = useState<IBet[]>([]);
  const [mode, setMode] = useState<"points" | "individual">("points");
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const unpaidCount = unpaidBets.length;
  const unpaidTotal = unpaidCount * PRICE_INDIVIDUAL;

  async function load() {
    const [{ data: pays }, { data: bets }] = await Promise.all([
      supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("individual_bets").select("id,match_id,home_score,away_score,paid").eq("user_id", userId).eq("paid", false),
    ]);
    if (pays) setPayments(pays as Payment[]);
    if (bets) setUnpaidBets(bets as IBet[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("pay-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "individual_bets", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  useEffect(() => {
    if (mode === "individual") setAmount(String(unpaidTotal || PRICE_INDIVIDUAL));
  }, [mode, unpaidTotal]);

  function changeMode(m: "points" | "individual") {
    setMode(m);
    setAmount(m === "points" ? "50" : String(unpaidTotal || PRICE_INDIVIDUAL));
    setRegistered(false);
  }


  function buildWhatsAppUrl() {
    const valor = parseFloat(amount || "0");
    const modoLabel = mode === "points" ? "Bolão de pontos" : "Palpite individual";
    const msg = encodeURIComponent(
      `Olá! Sou *${email ?? ""}*. Acabei de registrar um pagamento de R$ ${valor.toFixed(2)} (${modoLabel}).${note ? " Obs: " + note : ""} Segue o comprovante em anexo.`
    );
    return `https://wa.me/${supportPhone}?text=${msg}`;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("payments").insert({
      user_id: userId, amount: parseFloat(amount), mode, proof_note: note || null,
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
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
  }

  const pointsConfirmed = payments.some((p) => p.mode === "points" && p.status === "confirmed");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pagamento via PIX {pointsConfirmed && <Badge className="bg-emerald-600">Bolão de pontos pago</Badge>}
          </CardTitle>
          <CardDescription>Escolha a modalidade, faça o PIX e registre aqui. O admin confirma manualmente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Chave PIX</p>
            <p className="font-mono text-sm break-all">{PIX_KEY}</p>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => { navigator.clipboard.writeText(PIX_KEY); toast.success("Chave copiada"); }}>Copiar chave</Button>
          </div>

          <Tabs value={mode} onValueChange={(v) => changeMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="points">Bolão de pontos (R$ 50)</TabsTrigger>
              <TabsTrigger value="individual">Palpite individual (R$ 10)</TabsTrigger>
            </TabsList>
            <TabsContent value="points" className="text-xs text-muted-foreground pt-2">
              Pagamento único de R$ 50 para entrar no ranking acumulado da Copa.
            </TabsContent>
            <TabsContent value="individual" className="text-xs text-muted-foreground pt-2 space-y-2">
              <p>Cada palpite individual custa <strong>R$ {PRICE_INDIVIDUAL}</strong>, independente do jogo. Você pode fazer quantos quiser (inclusive vários no mesmo jogo).</p>
              <div className="rounded-md border bg-muted/40 p-2 text-foreground">
                Palpites em aberto: <strong>{unpaidCount}</strong> × R$ {PRICE_INDIVIDUAL} = <strong>R$ {unpaidTotal.toFixed(2)}</strong>
                {unpaidCount === 0 && <span className="block text-muted-foreground">Nenhum palpite pendente de pagamento.</span>}
              </div>
            </TabsContent>


          <form onSubmit={handleRegister} className="space-y-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min={0} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea placeholder={mode === "individual" ? "Diga quais jogos este pagamento cobre" : "Ex: ID da transação"} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {!hasPhone && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
                ⚠️ O administrador ainda não cadastrou o número de WhatsApp para envio do comprovante. Peça ao admin para configurar em <strong>Configurações → WhatsApp de suporte</strong>.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button type="submit" disabled={loading} variant="outline" className="w-full">
                {loading ? "Registrando…" : registered ? "✓ Registrado" : "1. Registrar pagamento"}
              </Button>
              <Button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={!hasPhone}
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
        <CardHeader><CardTitle className="text-base">Meus envios</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum envio.</p>}
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium flex items-center gap-2">R$ {Number(p.amount).toFixed(2)}
                  <Badge variant="outline" className="text-[10px]">{p.mode === "individual" ? "Individual" : "Pontos"}</Badge>
                </div>
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
