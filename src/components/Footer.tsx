import { useSettings } from "@/lib/useSettings";
import { MessageCircle, Users } from "lucide-react";

export function Footer() {
  const { settings } = useSettings();
  const supportPhone = settings.whatsapp_support_phone;
  const groupUrl = settings.whatsapp_group_url;

  return (
    <footer className="mt-8 border-t bg-gradient-to-r from-emerald-50 via-yellow-50 to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-5 text-center text-xs text-muted-foreground space-y-2">
        <p>
          Administrador: <strong className="text-foreground">FRR</strong>
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {supportPhone && (
            <a
              href={`https://wa.me/${supportPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium"
            >
              <MessageCircle className="h-3 w-3" /> Suporte WhatsApp
            </a>
          )}
          {groupUrl && (
            <a
              href={groupUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-500 text-slate-900 hover:bg-yellow-400 text-xs font-medium"
            >
              <Users className="h-3 w-3" /> Entrar no grupo
            </a>
          )}
        </div>
        <p className="opacity-70">© {new Date().getFullYear()} Bolão Copa 2026</p>
      </div>
    </footer>
  );
}
