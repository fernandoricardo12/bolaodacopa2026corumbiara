import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Lock, Trophy, Trash2, Plus, Flame, MessageCircle, Copy } from "lucide-react";
import { FlagImg } from "@/lib/flags";
import { useSettings } from "@/lib/useSettings";
import { useAuth } from "@/lib/useAuth";

type Team = { id: string; name: string; flag: string; code: string };
type Match = {
  id: string; home_team_id: string; away_team_id: string; kickoff: string;
  venue: string | null;
  home_score: number | null; away_score: number | null; finished: boolean;
  is_friendly?: boolean;
  live_clock?: string | null; live_period?: number | null; live_status_detail?: string | null;
  updated_at?: string | null;
};
type IBet = { id: string; match_id: string; home_score: number; away_score: number; amount: number; paid: boolean; payout: number };

const PRICE = 2;

export function FriendlyTab({ userId }: { userId: string }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const email = user?.email ?? "";
  const pixKey = settings?.pix_key || "";
  const supportPhone = (settings?.whatsapp_support_phone || "").replace(/\D/g, "");
  const hasPhone = supportPhone.length >= 10;
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [myBets, setMyBets] = useState<IBet[]>([]);
  const [allBets, setAllBets] = useState<IBet[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { h: string; a: string }>>({});
  const [paying, setPaying] = useState<Record<string, boolean>>({});
  const [registeredFor, setRegisteredFor] = useState<Record<string, boolean>>({});

  async function load() {
    const [{ data: ts }, { data: ms }, { data: bs }, { data: all }] = await Promise.all([
      supabase.from("teams").select("id,name,flag,code"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("individual_bets").select("*").eq("user_id", userId),
      supabase.from("individual_bets").select("match_id,paid,amount"),
    ]);
    if (ts) setTeams(Object.fromEntries(ts.map((t) => [t.id, t])));
    if (ms) setMatches((ms as Match[]).filter((m) => m.is_friendly));
    if (bs) setMyBets(bs as IBet[]);
    if (all) setAllBets(all as IBet[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("friendly-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "individual_bets" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // Auto-sync de placares enquanto houver jogo ao vivo (entre kickoff e +3h, não finalizado).
  useEffect(() => {
    const hasLive = matches.some((m) => {
      if (m.finished) return false;
      const ko = new Date(m.kickoff).getTime();
      const now = Date.now();
      return ko <= now && now - ko < 3 * 60 * 60 * 1000;
    });
    if (!hasLive) return;
    const tick = () => { fetch("/api/public/sync-scores-auto", { method: "POST" }).catch(() => {}); };
    tick();
    const id = setInterval(tick, 45_000);
    return () => clearInterval(id);
  }, [matches]);

  // Ticker local: avança o cronômetro 1s a 1s entre as sincronizações do servidor.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const hasLive = matches.some((m) => {
      if (m.finished) return false;
      const ko = new Date(m.kickoff).getTime();
      const now = Date.now();
      return ko <= now && now - ko < 3 * 60 * 60 * 1000;
    });
    if (!hasLive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [matches]);

  function liveClockDisplay(m: Match): string | null {
    if (!m.live_clock || !m.updated_at) return m.live_clock ?? null;
    const match = m.live_clock.match(/(\d+)(?:\+(\d+))?'?/);
    if (!match) return m.live_clock;
    const baseMin = parseInt(match[1], 10);
    const extra = match[2] ? parseInt(match[2], 10) : 0;
    const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(m.updated_at).getTime()) / 1000));
    const totalSec = baseMin * 60 + extra * 60 + elapsedSec;
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return extra > 0
      ? `${baseMin}'+${Math.max(extra, Math.floor(elapsedSec / 60))}` // tempo de acréscimo
      : `${mm}:${ss.toString().padStart(2, "0")}`;
  }
  void tick; // força re-render via state acima

  const friendlyMatchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);
  const myFriendlyBets = useMemo(() => myBets.filter((b) => friendlyMatchIds.has(b.match_id)), [myBets, friendlyMatchIds]);
  const allFriendlyBets = useMemo(() => allBets.filter((b) => friendlyMatchIds.has(b.match_id)), [allBets, friendlyMatchIds]);

  const betsByMatch = useMemo(() => {
    const r: Record<string, IBet[]> = {};
    myFriendlyBets.forEach((b) => { (r[b.match_id] ||= []).push(b); });
    return r;
  }, [myFriendlyBets]);

  const poolByMatch = useMemo(() => {
    const r: Record<string, { total: number; paid: number; count: number }> = {};
    allFriendlyBets.forEach((b) => {
      r[b.match_id] ||= { total: 0, paid: 0, count: 0 };
      r[b.match_id].total += Number(b.amount);
      r[b.match_id].count += 1;
      if (b.paid) r[b.match_id].paid += Number(b.amount);
    });
    return r;
  }, [allFriendlyBets]);

  async function addBet(matchId: string) {
    const d = drafts[matchId];
    if (!d || d.h === "" || d.a === "") return toast.error("Preencha o placar");
    const h = parseInt(d.h), a = parseInt(d.a);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return toast.error("Placar inválido");
    const dup = (betsByMatch[matchId] ?? []).some((b) => b.home_score === h && b.away_score === a);
    if (dup) return toast.error("Você já tem um palpite com esse placar");
    const { error } = await supabase.from("individual_bets")
      .insert({ user_id: userId, match_id: matchId, home_score: h, away_score: a, amount: PRICE });
    if (error) toast.error(error.message);
    else {
      toast.success(`Palpite registrado (R$ ${PRICE} a pagar no PIX)`);
      setDrafts((p) => ({ ...p, [matchId]: { h: "", a: "" } }));
    }
  }

  async function deleteBet(bet: IBet) {
    if (bet.paid) return toast.error("Palpite já pago não pode ser excluído");
    if (!confirm(`Excluir o palpite ${bet.home_score}×${bet.away_score}?`)) return;
    const { error } = await supabase.from("individual_bets").delete().eq("id", bet.id);
    if (error) toast.error(error.message); else toast.success("Palpite excluído");
  }

  async function registerPayment(matchId: string, unpaid: IBet[], label: string) {
    if (unpaid.length === 0) return;
    setPaying((p) => ({ ...p, [matchId]: true }));
    const total = unpaid.length * PRICE;
    const scores = unpaid.map((b) => `${b.home_score}×${b.away_score}`).join(", ");
    const { error } = await supabase.from("payments").insert({
      user_id: userId, amount: total, mode: "individual", match_id: matchId,
      proof_note: `${label} — palpites: ${scores}`,
    });
    setPaying((p) => ({ ...p, [matchId]: false }));
    if (error) return toast.error(error.message);
    setRegisteredFor((p) => ({ ...p, [matchId]: true }));
    toast.success("Pagamento registrado! Agora envie o comprovante pelo WhatsApp.");
  }

  function sendWhatsApp(matchId: string, unpaid: IBet[], label: string) {
    if (!hasPhone) return toast.error("WhatsApp do administrador ainda não cadastrado.");
    const total = unpaid.length * PRICE;
    const scores = unpaid.map((b) => `${b.home_score}×${b.away_score}`).join(", ");
    const msg = encodeURIComponent(
      `Olá! Sou *${email}*. Acabei de registrar um pagamento de R$ ${total.toFixed(2)} (amistoso) referente a *${label}* — palpites: ${scores}. Segue o comprovante em anexo.`,
    );
    const url = `https://api.whatsapp.com/send?phone=${supportPhone}&text=${msg}`;
    try { const win = window.open(url, "_blank", "noopener,noreferrer"); if (!win) window.location.href = url; }
    catch { window.location.href = url; }
  }

  function copyPix() {
    if (!pixKey) return toast.error("Chave PIX não cadastrada");
    navigator.clipboard?.writeText(pixKey)
      .then(() => toast.success("Chave PIX copiada"))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhum amistoso disponível no momento.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-emerald-600 via-yellow-400 to-emerald-600 border-0 text-emerald-950 shadow-lg">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center gap-2 font-bold text-base">
            <Flame className="h-5 w-5" /> 🇧🇷 Amistoso da Seleção
          </div>
          <p className="text-xs leading-snug">
            <strong>R$ {PRICE} por palpite</strong> · vários palpites por jogo (cada um vira um PIX separado).
            <br />
            🎯 <strong>Placar exato:</strong> leva 80% do bolo (dividido entre quem acertou).
            <br />
            ✅ <strong>Só o vencedor:</strong> leva 60% do bolo — <em>apenas se ninguém acertar o placar exato</em>.
            <br />
            Sincronização automática do placar ao vivo.
          </p>
        </CardContent>
      </Card>

      {matches.map((m) => {
        const home = teams[m.home_team_id]; const away = teams[m.away_team_id];
        if (!home || !away) return null;
        const userBets = betsByMatch[m.id] ?? [];
        const kickoffMs = new Date(m.kickoff).getTime();
        const nowMs = Date.now();
        const isLive = !m.finished && kickoffMs <= nowMs && nowMs - kickoffMs < 3 * 60 * 60 * 1000;
        const hasLiveScore = isLive && m.home_score !== null && m.away_score !== null;
        const locked = m.finished || kickoffMs <= nowMs;
        const d = drafts[m.id] ?? { h: "", a: "" };
        const pool = poolByMatch[m.id] ?? { total: 0, paid: 0, count: 0 };
        return (
          <Card key={m.id} className={`border-2 shadow-lg ring-2 ${isLive ? "border-red-500 ring-red-200 dark:ring-red-900/40" : "border-yellow-400 ring-yellow-200 dark:ring-yellow-900/40"}`}>
            <div className={`text-xs font-bold px-3 py-1 flex items-center gap-1 rounded-t-lg ${isLive ? "bg-gradient-to-r from-red-600 to-red-500 text-white" : "bg-gradient-to-r from-emerald-600 to-yellow-400 text-emerald-950"}`}>
              {isLive ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  AO VIVO · AMISTOSO BRASIL
                </>
              ) : (
                <><Flame className="h-3.5 w-3.5" /> AMISTOSO BRASIL</>
              )}
            </div>
            <CardContent className="p-4 space-y-3">
              {hasLiveScore && (
                <div className="rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white px-3 py-3 shadow-md space-y-1">
                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-90">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    Ao vivo
                    {liveClockDisplay(m) && <span className="tabular-nums">· {liveClockDisplay(m)}</span>}
                    {m.live_period != null && (
                      <span>· {m.live_period === 1 ? "1º tempo" : m.live_period === 2 ? "2º tempo" : `${m.live_period}º período`}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-sm font-semibold truncate max-w-[35%] text-right">{home.name}</span>
                    <span className="text-3xl font-extrabold tabular-nums">{m.home_score}<span className="opacity-70 mx-2">×</span>{m.away_score}</span>
                    <span className="text-sm font-semibold truncate max-w-[35%]">{away.name}</span>
                  </div>
                  {m.live_status_detail && (
                    <div className="text-center text-[11px] opacity-90">{m.live_status_detail}</div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
                <div className="flex gap-2 items-center">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(m.kickoff).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  {m.venue && <span className="hidden sm:inline">· {m.venue}</span>}
                </div>
                {locked && <Lock className="h-3 w-3" />}
              </div>

              {(() => {
                const matchBets = allFriendlyBets.filter((b) => b.match_id === m.id && b.paid);
                const lh = m.home_score, la = m.away_score;
                const hasScore = lh !== null && la !== null;
                const exactWinners = hasScore ? matchBets.filter((b) => b.home_score === lh && b.away_score === la) : [];

                if (!hasScore) {
                  return (
                    <div className="rounded-md border border-emerald-300 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs space-y-1">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-200">💰 Bolão acumulado</div>
                      <div className="tabular-nums">🎯 Placar exato (80%): <strong className="text-emerald-700 dark:text-emerald-300">R$ {(pool.paid * 0.8).toFixed(2)}</strong></div>
                      <div className="text-[10px] text-muted-foreground">* Só é pago se alguém cravar o placar exato. Sem acertador, o bolão acumula para o próximo jogo.</div>
                    </div>
                  );
                }

                if (exactWinners.length > 0) {
                  const prize = (pool.paid * 0.8) / exactWinners.length;
                  return (
                    <div className="rounded-md border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs space-y-1">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-200">🎯 Placar exato no momento</div>
                      <div className="tabular-nums">{exactWinners.length} apostador{exactWinners.length > 1 ? "es" : ""} · <strong>R$ {prize.toFixed(2)}</strong> cada (se terminar assim)</div>
                    </div>
                  );
                }

                return (
                  <div className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs">
                    <div className="font-semibold">Ninguém cravou o placar atual</div>
                    <div className="text-[11px] text-muted-foreground">Bolão de R$ {pool.paid.toFixed(2)} — se ninguém acertar o placar exato até o fim, não há prêmio (acumula).</div>
                  </div>
                );
              })()}




              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
                  <FlagImg code={home.code} name={home.name} size={40} />
                  <div className="text-xs sm:text-sm font-medium text-right truncate w-full">{home.name}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {m.finished ? (
                    <div className="text-2xl sm:text-3xl font-bold tabular-nums">{m.home_score}<span className="text-muted-foreground mx-1">×</span>{m.away_score}</div>
                  ) : (
                    <>
                      <Input className="w-12 sm:w-14 text-center text-lg px-1" type="number" inputMode="numeric" min={0} disabled={locked} value={d.h}
                        onChange={(e) => setDrafts({ ...drafts, [m.id]: { ...d, h: e.target.value } })} />
                      <span className="text-muted-foreground">×</span>
                      <Input className="w-12 sm:w-14 text-center text-lg px-1" type="number" inputMode="numeric" min={0} disabled={locked} value={d.a}
                        onChange={(e) => setDrafts({ ...drafts, [m.id]: { ...d, a: e.target.value } })} />
                    </>
                  )}
                </div>
                <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
                  <FlagImg code={away.code} name={away.name} size={40} />
                  <div className="text-xs sm:text-sm font-medium truncate w-full">{away.name}</div>
                </div>
              </div>

              {!locked && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => addBet(m.id)} className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar palpite (R$ {PRICE})
                  </Button>
                </div>
              )}

              {userBets.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">Seus palpites ({userBets.length})</div>
                  {userBets.map((bet) => (
                    <div key={bet.id} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="tabular-nums">{bet.home_score}×{bet.away_score}</strong>
                        {bet.paid
                          ? <Badge className="bg-emerald-600 text-[10px]">pago</Badge>
                          : <Badge variant="secondary" className="text-[10px]">pagto pendente</Badge>}
                        {m.finished && bet.payout > 0 && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <Trophy className="h-3 w-3" /> R$ {Number(bet.payout).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {!locked && !bet.paid && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteBet(bet)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const unpaid = userBets.filter((b) => !b.paid);
                if (unpaid.length === 0) return null;
                const total = unpaid.length * PRICE;
                const label = `${home.name} × ${away.name}`;
                const isPaying = !!paying[m.id];
                const wasRegistered = !!registeredFor[m.id];
                return (
                  <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
                    <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                      💸 Pagar agora — {unpaid.length} palpite{unpaid.length > 1 ? "s" : ""} × R$ {PRICE} =
                      <strong className="tabular-nums">R$ {total.toFixed(2)}</strong>
                    </div>
                    {pixKey && (
                      <div className="rounded-md bg-white dark:bg-background border px-2 py-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] text-muted-foreground uppercase">Chave PIX</div>
                          <div className="font-mono text-xs truncate">{pixKey}</div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={copyPix}>
                          <Copy className="h-3 w-3 mr-1" /> Copiar
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" disabled={isPaying || wasRegistered}
                        onClick={() => registerPayment(m.id, unpaid, label)}>
                        {isPaying ? "Registrando…" : wasRegistered ? "✓ Registrado" : `1. Registrar R$ ${total.toFixed(2)}`}
                      </Button>
                      <Button size="sm" disabled={!hasPhone}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => sendWhatsApp(m.id, unpaid, label)}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1" /> 2. Enviar comprovante
                      </Button>
                    </div>
                    <p className="text-[10px] text-emerald-900/70 dark:text-emerald-100/70 text-center">
                      Faça o PIX, registre aqui e envie o comprovante pelo WhatsApp. O admin confirma manualmente.
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
