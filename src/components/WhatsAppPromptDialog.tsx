import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { isValidBrPhone, toWaDigits } from "@/lib/whatsapp";

/**
 * Pede o WhatsApp uma única vez (quando o perfil ainda não tem `phone`).
 * Inclui participantes antigos que se cadastraram antes desta funcionalidade.
 */
export function WhatsAppPromptDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("+55 ");
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const hasPhone = !!data?.phone && data.phone.trim().length > 0;
      setOpen(!hasPhone);
      setChecked(true);
    }
    check();
    return () => { cancelled = true; };
  }, [userId]);

  async function save() {
    if (!isValidBrPhone(phone)) {
      toast.error("Informe um WhatsApp válido com DDD (ex.: +55 11 99999-9999).");
      return;
    }
    setSaving(true);
    const normalized = "+" + toWaDigits(phone);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: normalized })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("WhatsApp salvo! 🎉");
    setOpen(false);
  }

  if (!checked) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { /* não permite fechar sem salvar */ if (v) setOpen(true); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Cadastre seu WhatsApp
          </DialogTitle>
          <DialogDescription>
            Precisamos do seu número para enviar avisos importantes do bolão (resultados, prêmios e comunicados do administrador). É rápido — só uma vez! 📱
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="wa-phone">Seu WhatsApp (com DDD)</Label>
          <Input
            id="wa-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Já preenchemos o código do Brasil (+55). Inclua o DDD e o número.</p>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Salvando…" : "Salvar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
