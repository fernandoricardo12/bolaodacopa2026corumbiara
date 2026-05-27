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

export function PaymentTab({ userId, email }: { userId: string; email?: string }) {
  const { settings } = useSettings();
  const PIX_KEY = settings.pix_key || "—";
  const supportPhone = (settings.whatsapp_support_phone || "5569984236281").replace(/\D/g, "");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [mode, setMode] = useState<"points" | "individual">("points");
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setPayments(data as Payment[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("pay-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  function changeMode(m: "points" | "individual") {
    setMode(m);
    setAmount(m === "points" ? "50" : "10");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("payments").insert({
      user_id: userId, amount: parseFloat(amount), mode, proof_note: note || null,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Comprovante registrado! Envie pelo WhatsApp para confirmação.");
      const msg = encodeURIComponent(`Olá! Sou *${ (await supabase.auth.getUser()).data.user?.email ?? "" }*. Acabei de registrar um pagamento de R$ ${parseFloat(amount).toFixed(2)} (${mode === "points" ? "Bolão de pontos" : "Palpite individual"}). ${note ? "Obs: " + note : ""} Segue o comprovante em anexo.`);
      window.open(`https://wa.me/${supportPhone}?text=${msg}`, "_blank");
      setNote("");
    }

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
            <TabsContent value="individual" className="text-xs text-muted-foreground pt-2">
              Cada R$ 10 corresponde a um palpite individual (ver aba Individual). Registre um pagamento por palpite ou um único pagamento somando vários (descreva quais jogos na observação).
            </TabsContent>
          </Tabs>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min={0} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea placeholder={mode === "individual" ? "Diga quais jogos este pagamento cobre" : "Ex: ID da transação"} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <MessageCircle className="h-4 w-4 mr-2" /> Registrar e enviar comprovante via WhatsApp
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              O WhatsApp será aberto com mensagem pré-preenchida. Anexe o comprovante e envie.
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
