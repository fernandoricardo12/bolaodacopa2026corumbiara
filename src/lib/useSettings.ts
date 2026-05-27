import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  pix_key: string;
  whatsapp_group_url: string;
  whatsapp_support_phone: string;
  about_text: string;
};

const DEFAULTS: AppSettings = {
  pix_key: "",
  whatsapp_group_url: "",
  whatsapp_support_phone: "",
  about_text: "Plataforma criada para diversão e apostas entre amigos.",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from("app_settings").select("key,value");
    if (data) {
      const merged = { ...DEFAULTS };
      for (const row of data) {
        if (row.key in merged && row.value !== null) {
          (merged as Record<string, string>)[row.key] = row.value;
        }
      }
      setSettings(merged);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`app-settings-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return { settings, loading, reload: load };
}
