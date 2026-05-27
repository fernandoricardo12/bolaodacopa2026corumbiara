import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";

export function ContactInfoCard({ userId }: { userId: string }) {
  const [phone, setPhone] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState({ phone: "", pixKey: "" });

  useEffect(() => {
    supabase
      .from("profiles")
      .select("phone,pix_key")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const p = (data?.phone ?? "") as string;
        const k = (data?.pix_key ?? "") as string;
        setPhone(p);
        setPixKey(k);
        setInitial({ phone: p, pixKey: k });
      });
  }, [userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.trim().slice(0, 20);
    const cleanPix = pixKey.trim().slice(0, 120);
    if (cleanPhone && cleanPhone.replace(/\D/g, "").length < 10) {
      toast.error("Informe um telefone válido com DDD.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: cleanPhone || null, pix_key: cleanPix || null })
      .eq("id", userId);
    setLoading(false);
    if (error) return toast.error(error.message);
    setInitial({ phone: cleanPhone, pixKey: cleanPix });
    toast.success("Dados de contato salvos!");
  }

  const complete = !!initial.phone && !!initial.pixKey;
  const dirty = phone.trim() !== initial.phone || pixKey.trim() !== initial.pixKey;

  return (
    <Card className={complete ? "" : "border-amber-400"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Meus dados para premiação
          {complete ? (
            <Badge className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completo</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />Incompleto
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Cadastre seu <strong>telefone</strong> e sua <strong>chave PIX</strong>. O administrador usa esses dados para entrar em contato e pagar os prêmios aos vencedores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1">
            <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Telefone / WhatsApp</Label>
            <Input
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Chave PIX para receber prêmios</Label>
            <Input
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              maxLength={120}
            />
          </div>
          <Button type="submit" disabled={loading || !dirty} className="w-full sm:w-auto">
            {loading ? "Salvando…" : dirty ? "Salvar dados" : "✓ Dados salvos"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
