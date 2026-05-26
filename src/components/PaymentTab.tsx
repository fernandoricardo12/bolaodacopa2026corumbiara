import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

type Payment = { id: string; amount: number; status: string; proof_note: string | null; created_at: string; confirmed_at: string | null };

const PIX_KEY = "bolao@copa2026.com.br";
const DEFAULT_AMOUNT = 50;

export function PaymentTab({ userId }: { userId: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState(String(DEFAULT_AMOUNT));
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("payments").insert({
      user_id: userId,
      amount: parseFloat(amount),
      proof_note: note || null,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Comprovante enviado! Aguarde confirmação do admin."); setNote(""); }
  }

  const confirmed = payments.some((p) => p.status === "confirmed");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pagamento via PIX {confirmed && <Badge className="bg-emerald-600">Confirmado</Badge>}
          </CardTitle>
          <CardDescription>Envie o pagamento e registre aqui. O admin confirma manualmente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground mb-1">Chave PIX</p>
            <p className="font-mono text-sm break-all">{PIX_KEY}</p>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => { navigator.clipboard.writeText(PIX_KEY); toast.success("Chave copiada"); }}>Copiar chave</Button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min={0} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observação (opcional)</Label>
              <Textarea placeholder="Ex: ID da transação, data, etc." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">Registrar pagamento</Button>
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
                <div className="font-medium">R$ {Number(p.amount).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</div>
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
