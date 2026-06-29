import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Send, AlarmClock, Copy } from "lucide-react";
import { toast } from "sonner";
import { buildWaLink, isValidBrPhone } from "@/lib/whatsapp";

type Team = { id: string; name: string; flag: string; code: string };
type Match = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  stage: string;
  group_name: string | null;
  finished: boolean;
  is_friendly?: boolean;
  featured?: boolean;
  bonus_prize?: number | null;
};
type Profile = { id: string; display_name: string; phone?: string | null };
type Bet = { user_id: string; match_id: string };

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function fmtKickoff(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function buildReminderMessage(
  name: string,
  homeName: string,
  awayName: string,
  kickoff: string,
  opts: { featured?: boolean; bonus?: number } = {},
) {
  const first = name?.split(" ")[0] ?? "";
  const hora = new Date(kickoff).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = new Date(kickoff).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const bonus = Number(opts.bonus ?? 0);

  if (opts.featured) {
    return [
      `Eaí ${first}! 👋⚽`,
      "",
      `🔥 *JOGO EM DESTAQUE no Bolão Copa 2026* 🏆`,
      `*${homeName} × ${awayName}* — ${dia} às ${hora}.`,
      "",
      "🪙 *Bolão Individual liberado!* Aposte *R$ 5* no placar exato:",
      "• 80% do bolo p/ quem cravar o placar exato (dividido em caso de empate)",
      "• 🔄 Se ninguém cravar, os 80% acumulam pro próximo jogo em destaque",
      bonus > 0
        ? `• 🎁 *Bônus extra de R$ ${bonus.toFixed(2).replace(".", ",")}* dividido entre quem cravar o placar exato`
        : "",
      "⚖️ Havendo mais de um ganhador, a premiação é sempre dividida.",
      "",
      "⏰ Palpites fecham *10 minutos antes* do jogo. Não fica de fora!",
      "",
      "👉 Manda seu palpite agora na aba *Individual*:",
      "https://bolaodacopa2026corumbiara.lovable.app",
      "",
      "Boa sorte! 🍀🇧🇷",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Eaí ${first}! 👋⚽`,
    "",
    `Lembrete rápido do *Bolão Copa 2026* 🏆`,
    `Você ainda não palpitou em *${homeName} × ${awayName}* — bola rola ${dia} às ${hora}.`,
    "",
    "⏰ Os palpites fecham *10 minutos antes* do início. Não perca os pontos!",
    "",
    "👉 Entra no bolão e manda seu palpite agora:",
    "https://bolaodacopa2026corumbiara.lovable.app",
    "",
    "Boa sorte! 🍀🇧🇷",
  ].join("\n");
}


export function ReminderBetsTab() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [bets, setBets] = useState<Bet[]>([]);
  const [paidUsers, setPaidUsers] = useState<Set<string>>(new Set());
  const [windowHours, setWindowHours] = useState(2);
  const [now, setNow] = useState(() => new Date());

  async function load() {
    try {
      const [t, m, pr, b, pay] = await Promise.all([
        fetchAllRows<Team>((from, to) => supabase.from("teams").select("id,name,flag,code").range(from, to)),
        fetchAllRows<Match>((from, to) => supabase.from("matches").select("id,home_team_id,away_team_id,kickoff,stage,group_name,finished,is_friendly,featured,bonus_prize").order("kickoff").range(from, to)),
        fetchAllRows<Profile>((from, to) => supabase.from("profiles").select("id,display_name,phone").range(from, to)),
        fetchAllRows<Bet>((from, to) => supabase.from("bets").select("user_id,match_id").range(from, to)),
        fetchAllRows<{ user_id: string; mode: string; status: string }>((from, to) => supabase.from("payments").select("user_id,mode,status").eq("mode", "points").eq("status", "confirmed").range(from, to)),
      ]);
      setTeams(Object.fromEntries(t.map((x: any) => [x.id, x])));
      setMatches(m.filter((x) => !x.is_friendly));
      setProfiles(Object.fromEntries(pr.map((x: any) => [x.id, x])));
      setBets(b);
      setPaidUsers(new Set(pay.map((x) => x.user_id)));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar lembretes");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const upcoming = useMemo(() => {
    const limit = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
    return matches.filter((m) => !m.finished && new Date(m.kickoff) > now && new Date(m.kickoff) <= limit);
  }, [matches, now, windowHours]);

  const byMatch = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    bets.forEach((b) => {
      if (!map[b.match_id]) map[b.match_id] = new Set();
      map[b.match_id].add(b.user_id);
    });
    return map;
  }, [bets]);

  function copyMsg(msg: string) {
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
            <AlarmClock className="h-5 w-5" />
            Lembretes pré-jogo
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
            Lista de participantes do Bolão de Pontos que ainda não palpitaram nos jogos que começam dentro da janela escolhida.
            Os palpites fecham 10 minutos antes do jogo — avise com antecedência.
          </p>
          <div className="flex items-end gap-2 pt-1">
            <div>
              <Label className="text-[11px]">Janela (horas antes do jogo)</Label>
              <Input
                type="number"
                min={1}
                max={48}
                value={windowHours}
                onChange={(e) => setWindowHours(Math.max(1, Math.min(48, Number(e.target.value) || 2)))}
                className="w-24 h-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={load}>Atualizar</Button>
          </div>
        </CardContent>
      </Card>

      {upcoming.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum jogo nas próximas {windowHours}h.
        </p>
      )}

      {upcoming.map((m) => {
        const home = teams[m.home_team_id];
        const away = teams[m.away_team_id];
        if (!home || !away) return null;
        const placed = byMatch[m.id] ?? new Set();
        const missing = Array.from(paidUsers)
          .filter((uid) => !placed.has(uid))
          .map((uid) => profiles[uid])
          .filter(Boolean)
          .sort((a, b) => (a!.display_name ?? "").localeCompare(b!.display_name ?? ""));
        const minutesToKick = Math.round((new Date(m.kickoff).getTime() - now.getTime()) / 60000);
        const closesInMin = minutesToKick - 10;
        return (
          <Card key={m.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold">{home.flag} {home.name} × {away.name} {away.flag}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {fmtKickoff(m.kickoff)} · começa em {minutesToKick} min
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {closesInMin > 0 ? (
                    <Badge className="bg-amber-600">Palpites fecham em {closesInMin} min</Badge>
                  ) : (
                    <Badge variant="destructive">Palpites encerrados</Badge>
                  )}
                  <Badge variant="outline">{missing.length} pendente(s)</Badge>
                </div>
              </div>

              {missing.length === 0 ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">🎉 Todo mundo já palpitou neste jogo!</p>
              ) : (
                <div className="space-y-2">
                  {missing.map((p) => {
                    if (!p) return null;
                    const msg = buildReminderMessage(p.display_name, home.name, away.name, m.kickoff, { featured: m.featured, bonus: Number(m.bonus_prize ?? 0) });
                    const hasPhone = isValidBrPhone(p.phone);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.display_name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {hasPhone ? p.phone : <span className="text-amber-600">WhatsApp não cadastrado</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => copyMsg(msg)} title="Copiar mensagem">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={!hasPhone}
                            onClick={() => window.open(buildWaLink(p.phone!, msg), "_blank")}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> WhatsApp
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
