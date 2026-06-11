import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Lock, Coins, Trophy, Trash2, Sparkles, Plus, Flame, Star, MessageCircle, Copy } from "lucide-react";
import { FlagImg } from "@/lib/flags";
import { MatchFilters, filterMatches } from "@/components/MatchFilters";
import { useSettings } from "@/lib/useSettings";
import { useAuth } from "@/lib/useAuth";

type Team = { id: string; name: string; flag: string; code: string };
type Match = {
  id: string; home_team_id: string; away_team_id: string; kickoff: string;
  group_name: string | null; stage: string; venue: string | null;
  home_score: number | null; away_score: number | null; finished: boolean;
  featured: boolean; is_friendly?: boolean; bonus_prize?: number | null;
};
type IBet = { id: string; match_id: string; home_score: number; away_score: number; amount: number; paid: boolean; payout: number; payout_paid?: boolean };

const PRICE_OPTIONS = [2, 5] as const;
type Price = typeof PRICE_OPTIONS[number];
const POOL_HIGHLIGHT_THRESHOLD = 30;

export function IndividualBetsTab({ userId }: { userId: string }) {
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
  const [drafts, setDrafts] = useState<Record<string, { h: string; a: string; price: Price }>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, { h: string; a: string }>>({});
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [paying, setPaying] = useState<Record<string, boolean>>({});
  const [registeredFor, setRegisteredFor] = useState<Record<string, boolean>>({});
  const visible = useMemo(() => filterMatches(matches, teams, search, group), [matches, teams, search, group]);

  async function load() {
    const [{ data: ts }, { data: ms }, { data: bs }, { data: all }] = await Promise.all([
      supabase.from("teams").select("id,name,flag,code"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("individual_bets").select("*").eq("user_id", userId),
      supabase.from("individual_bets").select("id,match_id,home_score,away_score,amount,paid,payout"),
    ]);
    if (ts) setTeams(Object.fromEntries(ts.map((t) => [t.id, t])));
    if (ms) {
      setMatches((ms as Match[]).filter((m) => m.featured));
    }
    if (bs) setMyBets(bs as IBet[]);
    if (all) setAllBets(all as IBet[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("ind-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "individual_bets" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // Auto-sync de placares enquanto houver jogo ao vivo (kickoff até +3h, não finalizado).
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

  const betsByMatch = useMemo(() => {
    const r: Record<string, IBet[]> = {};
    myBets.forEach((b) => { (r[b.match_id] ||= []).push(b); });
    return r;
  }, [myBets]);

  const poolByMatch = useMemo(() => {
    const r: Record<string, { total: number; paid: number; count: number }> = {};
    allBets.forEach((b) => {
      r[b.match_id] ||= { total: 0, paid: 0, count: 0 };
      r[b.match_id].total += Number(b.amount);
      r[b.match_id].count += 1;
      if (b.paid) r[b.match_id].paid += Number(b.amount);
    });
    return r;
  }, [allBets]);

  // Ordena: não-finalizados primeiro (destaques no topo), finalizados no final
  const sortedVisible = useMemo(() => {
    return [...visible].sort((a, b) => {
      if (a.finished && !b.finished) return 1;
      if (!a.finished && b.finished) return -1;
      if (!a.finished && !b.finished) {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
      }
      // ambos finalizados: mais recentes primeiro
      return new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();
    });
  }, [visible]);

  async function addBet(matchId: string, price: Price) {
    const d = drafts[matchId];
    if (!d || d.h === "" || d.a === "") return toast.error("Preencha o placar");
    const h = parseInt(d.h), a = parseInt(d.a);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return toast.error("Placar inválido");
    const dup = (betsByMatch[matchId] ?? []).some((b) => b.home_score === h && b.away_score === a && Number(b.amount) === price);
    if (dup) return toast.error(`Você já tem um palpite ${h}×${a} de R$ ${price} neste jogo`);
    const { error } = await supabase.from("individual_bets")
      .insert({ user_id: userId, match_id: matchId, home_score: h, away_score: a, amount: price });
    if (error) toast.error(error.message);
    else {
      toast.success(`Palpite de R$ ${price} registrado (pagar no PIX)`);
      setDrafts((p) => ({ ...p, [matchId]: { h: "", a: "", price } }));
    }
  }

  async function deleteBet(bet: IBet) {
    if (bet.paid) return toast.error("Palpite já pago não pode ser excluído");
    if (!confirm(`Excluir o palpite ${bet.home_score}×${bet.away_score}?`)) return;
    const { error } = await supabase.from("individual_bets").delete().eq("id", bet.id);
    if (error) toast.error(error.message); else toast.success("Palpite excluído");
  }

  async function updateBet(bet: IBet) {
    const d = editDrafts[bet.id] ?? { h: bet.home_score.toString(), a: bet.away_score.toString() };
    if (d.h === "" || d.a === "") return toast.error("Preencha o placar");
    const h = parseInt(d.h), a = parseInt(d.a);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return toast.error("Placar inválido");
    const dup = (betsByMatch[bet.match_id] ?? []).some((b) => b.id !== bet.id && b.home_score === h && b.away_score === a && Number(b.amount) === Number(bet.amount));
    if (dup) return toast.error("Você já tem outro palpite com esse placar e valor neste jogo");
    const { error } = await supabase.from("individual_bets")
      .update({ home_score: h, away_score: a })
      .eq("id", bet.id)
      .eq("user_id", userId);
    if (error) toast.error(error.message);
    else toast.success("Palpite atualizado!");
  }

  async function registerPayment(matchId: string, unpaid: IBet[], label: string) {
    if (unpaid.length === 0) return;
    setPaying((p) => ({ ...p, [matchId]: true }));
    const total = unpaid.reduce((s, b) => s + Number(b.amount), 0);
    const scores = unpaid.map((b) => `${b.home_score}×${b.away_score} (R$${Number(b.amount)})`).join(", ");
    const { error } = await supabase.from("payments").insert({
      user_id: userId,
      amount: total,
      mode: "individual",
      match_id: matchId,
      proof_note: `${label} — palpites: ${scores}`,
    });
    setPaying((p) => ({ ...p, [matchId]: false }));
    if (error) return toast.error(error.message);
    setRegisteredFor((p) => ({ ...p, [matchId]: true }));
    toast.success("Pagamento registrado! Agora envie o comprovante pelo WhatsApp.");
  }

  function sendWhatsApp(matchId: string, unpaid: IBet[], label: string) {
    if (!hasPhone) return toast.error("WhatsApp do administrador ainda não cadastrado.");
    const total = unpaid.reduce((s, b) => s + Number(b.amount), 0);
    const scores = unpaid.map((b) => `${b.home_score}×${b.away_score} (R$${Number(b.amount)})`).join(", ");
    const msg = encodeURIComponent(
      `Olá! Sou *${email}*. Acabei de registrar um pagamento de R$ ${total.toFixed(2)} (palpite individual) referente ao jogo *${label}* — palpites: ${scores}. Segue o comprovante em anexo.`,
    );
    const url = `https://api.whatsapp.com/send?phone=${supportPhone}&text=${msg}`;
    try {
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = url;
    } catch { window.location.href = url; }
  }

  function copyPix() {
    if (!pixKey) return toast.error("Chave PIX não cadastrada");
    navigator.clipboard?.writeText(pixKey)
      .then(() => toast.success("Chave PIX copiada"))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-emerald-500 to-yellow-400 border-0 text-white shadow-md">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 mt-0.5 shrink-0" />
          <p className="text-sm leading-snug">{settings.about_text}</p>
        </CardContent>
      </Card>

      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-300">
        <CardContent className="p-3 text-xs flex items-start gap-2">
          <Coins className="h-4 w-4 mt-0.5 text-amber-600" />
          <div className="space-y-1">
            <div><strong>Palpite Individual — escolha R$ 2 ou R$ 5 por palpite.</strong> Só valem os jogos marcados como destaque pelo administrador. Você pode fazer <strong>vários palpites no mesmo jogo</strong> (cada um vira um PIX separado).</div>
            <div>
              🎯 <strong>Placar exato:</strong> 80% do bolo do jogo, dividido proporcional ao valor apostado.
              <br />
              🏆 <strong>Só o vencedor:</strong> 60% do bolo proporcional ao valor — só vale se ninguém cravar o placar exato.
              <br />
              ⭐ <strong>Bônus extra (R$ 50):</strong> exclusivo para quem apostar <strong>R$ 5</strong> e cravar o placar exato.
            </div>
          </div>
        </CardContent>
      </Card>

      <MatchFilters search={search} onSearch={setSearch} group={group} onGroup={setGroup} />

      {sortedVisible.map((m, idx) => {
        const home = teams[m.home_team_id]; const away = teams[m.away_team_id];
        if (!home || !away) return null;
        const userBets = betsByMatch[m.id] ?? [];
        const locked = m.finished || new Date(m.kickoff).getTime() - Date.now() <= 10 * 60 * 1000;
        const d = drafts[m.id] ?? { h: "", a: "", price: 2 as Price };
        const pool = poolByMatch[m.id] ?? { total: 0, paid: 0, count: 0 };
        const bonus = Number(m.bonus_prize ?? 0);
        const prizeExact = pool.paid * 0.8 + bonus;
        const prizeWinner = pool.paid * 0.6;
        const showFeatured = m.featured && !m.finished;
        const prev = sortedVisible[idx - 1];
        const showFinishedDivider = m.finished && (!prev || !prev.finished);
        const card = (
          <Card
            key={m.id}
            className={showFeatured ? "border-2 border-yellow-400 shadow-lg ring-2 ring-yellow-200 dark:ring-yellow-900/40" : (m.finished ? "opacity-90" : "")}
          >
            {showFeatured && (
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 text-xs font-bold px-3 py-1 flex items-center gap-1 rounded-t-lg">
                <Flame className="h-3.5 w-3.5" /> JOGO TOP DA RODADA
                <Star className="h-3 w-3 ml-auto" />
              </div>
            )}
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
                <div className="flex gap-2 items-center">
                  {m.group_name && <Badge variant="secondary">Grupo {m.group_name}</Badge>}
                  <Clock className="h-3 w-3" />
                  <span>{new Date(m.kickoff).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                {locked && <Lock className="h-3 w-3" />}
              </div>

              {bonus > 0 && (
                <div className="rounded-md border-2 border-amber-400 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/40 px-3 py-2 text-xs flex items-center gap-2 animate-pulse">
                  <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">Premiação extra</div>
                    <div className="font-extrabold text-amber-900 dark:text-amber-100">+ R$ {bonus.toFixed(2)} para quem cravar o placar exato!</div>
                  </div>
                </div>
              )}

              <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs space-y-1">
                <div className="font-semibold text-emerald-800 dark:text-emerald-200 inline-flex items-center gap-1">
                  💰 Valendo agora
                </div>
                <div className="tabular-nums">🎯 Placar exato (80% do bolo, proporcional ao valor apostado): <strong className="text-emerald-700 dark:text-emerald-300">R$ {(pool.paid * 0.8).toFixed(2)}</strong></div>
                <div className="tabular-nums">🏆 Só o vencedor (60%, proporcional): <strong className="text-emerald-700 dark:text-emerald-300">R$ {prizeWinner.toFixed(2)}</strong></div>
                {bonus > 0 && <div className="tabular-nums">⭐ Bônus extra (só para quem apostar R$ 5 e cravar): <strong className="text-amber-700 dark:text-amber-300">R$ {bonus.toFixed(2)}</strong></div>}
                <div className="text-[10px] text-muted-foreground">* "Só vencedor" só é pago se ninguém cravar o placar exato. O prêmio não acumula entre jogos.</div>
              </div>


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
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => addBet(m.id, 2)}>
                    <Plus className="h-3 w-3 mr-1" /> Apostar R$ 2
                  </Button>
                  <Button size="sm" onClick={() => addBet(m.id, 5)} className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950">
                    <Plus className="h-3 w-3 mr-1" /> Apostar R$ 5 {bonus > 0 ? "★" : ""}
                  </Button>
                </div>
              )}

              {userBets.length > 0 && (() => {
                const lh = m.home_score, la = m.away_score;
                const hasScore = lh !== null && la !== null;
                const matchPaid = allBets.filter((b) => b.match_id === m.id && b.paid);
                const exactPaid = hasScore ? matchPaid.filter((b) => b.home_score === lh && b.away_score === la) : [];
                const winnerPaid = hasScore ? matchPaid.filter((b) => Math.sign(b.home_score - b.away_score) === Math.sign((lh as number) - (la as number))) : [];
                const exactAmountTotal = exactPaid.reduce((s, b) => s + Number(b.amount), 0);
                const winnerAmountTotal = winnerPaid.reduce((s, b) => s + Number(b.amount), 0);
                const premiumExactCount = exactPaid.filter((b) => Number(b.amount) >= 5).length;
                const projectedPayout = (bet: typeof userBets[number]) => {
                  if (!hasScore || !bet.paid) return 0;
                  const amt = Number(bet.amount);
                  if (bet.home_score === lh && bet.away_score === la && exactAmountTotal > 0) {
                    const base = (pool.paid * 0.8) * (amt / exactAmountTotal);
                    const bonusShare = amt >= 5 && premiumExactCount > 0 ? bonus / premiumExactCount : 0;
                    return base + bonusShare;
                  }
                  if (exactAmountTotal === 0 && winnerAmountTotal > 0 && Math.sign(bet.home_score - bet.away_score) === Math.sign((lh as number) - (la as number))) {
                    return (pool.paid * 0.6) * (amt / winnerAmountTotal);
                  }
                  return 0;
                };
                return (
                  <div className="space-y-1.5 pt-2 border-t">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase">Seus palpites ({userBets.length})</div>
                    {userBets.map((bet) => {
                      const finalPayout = Number(bet.payout) || 0;
                      const livePayout = projectedPayout(bet);
                      const showFinal = m.finished && finalPayout > 0;
                      const showLive = !m.finished && hasScore && livePayout > 0;
                      const edit = editDrafts[bet.id] ?? { h: bet.home_score.toString(), a: bet.away_score.toString() };
                      return (
                        <div key={bet.id} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1.5 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {!locked && !bet.payout_paid ? (
                              <div className="flex items-center gap-1">
                                <Input className="h-7 w-11 text-center px-1 text-xs" type="number" inputMode="numeric" min={0} value={edit.h}
                                  onChange={(e) => setEditDrafts({ ...editDrafts, [bet.id]: { ...edit, h: e.target.value } })} />
                                <span className="text-muted-foreground">×</span>
                                <Input className="h-7 w-11 text-center px-1 text-xs" type="number" inputMode="numeric" min={0} value={edit.a}
                                  onChange={(e) => setEditDrafts({ ...editDrafts, [bet.id]: { ...edit, a: e.target.value } })} />
                              </div>
                            ) : (
                              <strong className="tabular-nums">{bet.home_score}×{bet.away_score}</strong>
                            )}
                            <Badge variant="outline" className={`text-[10px] ${Number(bet.amount) >= 5 ? "border-yellow-500 text-yellow-700" : ""}`}>R$ {Number(bet.amount)}</Badge>
                            {bet.paid
                              ? <Badge className="bg-emerald-600 text-[10px]">pago</Badge>
                              : <Badge variant="secondary" className="text-[10px]">pagto pendente</Badge>}
                            {showFinal && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                <Trophy className="h-3 w-3" /> Ganhou R$ {finalPayout.toFixed(2)}
                              </span>
                            )}
                            {showLive && (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                <Trophy className="h-3 w-3" /> Ganharia R$ {livePayout.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {!locked && !bet.payout_paid && (
                            <div className="flex items-center gap-1 ml-auto">
                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => updateBet(bet)}>Atualizar</Button>
                              {!bet.paid && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteBet(bet)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {(() => {
                const unpaid = userBets.filter((b) => !b.paid);
                if (unpaid.length === 0) return null;
                const total = unpaid.reduce((s, b) => s + Number(b.amount), 0);
                const label = `${home.name} × ${away.name}`;
                const isPaying = !!paying[m.id];
                const wasRegistered = !!registeredFor[m.id];
                return (
                  <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
                    <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                      💸 Pagar agora — {unpaid.length} palpite{unpaid.length > 1 ? "s" : ""} =
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
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPaying || wasRegistered}
                        onClick={() => registerPayment(m.id, unpaid, label)}
                      >
                        {isPaying ? "Registrando…" : wasRegistered ? "✓ Registrado" : `1. Registrar R$ ${total.toFixed(2)}`}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!hasPhone}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => sendWhatsApp(m.id, unpaid, label)}
                      >
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
        if (showFinishedDivider) {
          return (
            <div key={m.id} className="space-y-3">
              <div className="flex items-center gap-3 pt-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jogos finalizados</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {card}
            </div>
          );
        }
        return card;
      })}
    </div>
  );
}
