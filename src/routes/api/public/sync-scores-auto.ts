import { createFileRoute } from "@tanstack/react-router";

// Sincronização automática usando a API pública da ESPN (sem chave).
// Casa pelos códigos FIFA das seleções + data do jogo (janela de 36h).
const ESPN_URLS = [
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard",
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.friendly/scoreboard",
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.friendly.w/scoreboard",
];

const ESPN_SUMMARY_URL =
  "https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";

const FINISHED_STATUSES = new Set([
  "STATUS_FINAL",
  "STATUS_FULL_TIME",
  "STATUS_ENDED",
  "STATUS_AET",
  "STATUS_PEN",
  "STATUS_FINAL_PEN",
  "STATUS_FINAL_AET",
  "STATUS_FINAL_OT",
]);

const PRE_GAME_STATUSES = new Set([
  "STATUS_SCHEDULED",
  "STATUS_PRE_GAME",
  "STATUS_DELAYED",
  "STATUS_POSTPONED",
  "STATUS_CANCELED",
  "STATUS_CANCELLED",
]);

const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "third", "final"]);
const EXTRA_TIME_STATUSES = new Set([
  "STATUS_OVERTIME",
  "STATUS_EXTRA_TIME",
  "STATUS_AET",
  "STATUS_PEN",
  "STATUS_SHOOTOUT",
  "STATUS_FINAL_AET",
  "STATUS_FINAL_PEN",
  "STATUS_FINAL_OT",
]);

async function fetchEspnSummary(eventId: string) {
  try {
    const res = await fetch(`${ESPN_SUMMARY_URL}${encodeURIComponent(eventId)}`, {
      headers: { "user-agent": "Mozilla/5.0 BolaoCopa2026" },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.header?.competitions?.[0] ?? null;
  } catch {
    return null;
  }
}

function regulationScoreFromLinescores(competitor: any) {
  if (!Array.isArray(competitor?.linescores) || competitor.linescores.length < 2) return null;
  const firstHalf = Number(competitor.linescores[0]?.value ?? competitor.linescores[0]?.displayValue);
  const secondHalf = Number(competitor.linescores[1]?.value ?? competitor.linescores[1]?.displayValue);
  if (!Number.isFinite(firstHalf) || !Number.isFinite(secondHalf)) return null;
  return firstHalf + secondHalf;
}

export const Route = createFileRoute("/api/public/sync-scores-auto")({
  server: {
    handlers: {
      GET: async () => handle(),
      POST: async () => handle(),
    },
  },
});

async function handle() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Busca placares ao vivo na ESPN (Copa + amistosos)
    const events: any[] = [];
    for (const url of ESPN_URLS) {
      try {
        const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 BolaoCopa2026" } });
        if (!res.ok) continue;
        const json: any = await res.json();
        if (Array.isArray(json?.events)) events.push(...json.events);
      } catch { /* ignora endpoint quebrado */ }
    }
    if (events.length === 0) {
      return Response.json({ error: "espn_fetch_failed" }, { status: 502 });
    }

    // 2) Pega jogos do banco que ainda não terminaram
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, external_match_id, stage, kickoff, finished, home_team_id, away_team_id, home_score, away_score",
      )
      .eq("finished", false);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, code");
    const teamCode = new Map<string, string>(
      (teams ?? []).map((t: any) => [t.id, (t.code ?? "").toUpperCase()]),
    );

    let updated = 0;
    const results: any[] = [];

    for (const m of matches ?? []) {
      const homeCode = teamCode.get(m.home_team_id) ?? "";
      const awayCode = teamCode.get(m.away_team_id) ?? "";
      if (!homeCode || !awayCode) continue;
      const kickoff = new Date(m.kickoff).getTime();

      // Procura o evento correspondente
      const ev = events.find((e) => {
        const comp = e?.competitions?.[0];
        if (!comp) return false;
        const codes = (comp.competitors ?? []).map((c: any) =>
          (c?.team?.abbreviation ?? "").toUpperCase(),
        );
        if (!codes.includes(homeCode) || !codes.includes(awayCode)) return false;
        const evDate = new Date(e.date).getTime();
        // janela de 36h para tolerar diferenças de fuso/horário
        return Math.abs(evDate - kickoff) < 36 * 60 * 60 * 1000;
      });
      if (!ev) continue;

      const comp = ev.competitions[0];
      const statusName: string =
        ev?.status?.type?.name ?? comp?.status?.type?.name ?? "";
      const statusState: string =
        ev?.status?.type?.state ?? comp?.status?.type?.state ?? "";
      const isFinished = FINISHED_STATUSES.has(statusName);
      if (!isFinished && (statusState === "pre" || PRE_GAME_STATUSES.has(statusName))) {
        continue;
      }
      const clock: string | null =
        ev?.status?.displayClock ?? comp?.status?.displayClock ?? null;
      const periodRaw = ev?.status?.period ?? comp?.status?.period ?? null;
      const period = Number.isFinite(Number(periodRaw)) ? Number(periodRaw) : null;
      const detail: string | null =
        ev?.status?.type?.shortDetail ??
        ev?.status?.type?.detail ??
        comp?.status?.type?.shortDetail ??
        null;

      const competitors = comp.competitors ?? [];
      const isKnockoutMatch =
        String(m.external_match_id ?? "").startsWith("ko:") ||
        KNOCKOUT_STAGES.has(String(m.stage ?? "").toLowerCase());

      // Mata-mata: a regra do bolão conta SOMENTE o tempo regulamentar.
      // O endpoint de placar ao vivo nem sempre traz parciais; quando é mata-mata,
      // buscamos o resumo detalhado e somamos apenas 1º + 2º tempo.
      const summaryComp = isKnockoutMatch && ev?.id ? await fetchEspnSummary(String(ev.id)) : null;
      const scoreCompetitors = summaryComp?.competitors ?? competitors;
      const useRegulationOnly =
        isKnockoutMatch ||
        EXTRA_TIME_STATUSES.has(statusName) ||
        Number(period ?? 0) > 2;
      const findScore = (code: string) => {
        const c = scoreCompetitors.find(
          (x: any) => (x?.team?.abbreviation ?? "").toUpperCase() === code,
        );
        if (useRegulationOnly) {
          const regulationScore = regulationScoreFromLinescores(c);
          if (regulationScore !== null) return regulationScore;

          // Em prorrogação/pênaltis sem parciais, não atualizamos para evitar
          // gravar gols da prorrogação como se fossem do tempo regulamentar.
          if (Number(period ?? 0) > 2 || EXTRA_TIME_STATUSES.has(statusName)) return null;
        }
        const s = c?.score;
        const n = s === undefined || s === null || s === "" ? null : Number(s);
        return Number.isFinite(n as number) ? (n as number) : null;
      };
      const h = findScore(homeCode);
      const a = findScore(awayCode);
      if (h === null || a === null) continue;


      const { error: uerr } = await supabaseAdmin
        .from("matches")
        .update({
          home_score: h,
          away_score: a,
          finished: isFinished,
          live_clock: isFinished ? null : clock,
          live_period: isFinished ? null : period,
          live_status_detail: isFinished ? null : detail,
        })
        .eq("id", m.id);

      const knockoutRef = String(m.external_match_id ?? "").match(/^ko:([A-Z0-9]+)-(\d+)$/i);
      if (!uerr && knockoutRef) {
        // Quando o jogo terminou (inclusive em prorrogação ou pênaltis), tentamos
        // descobrir o vencedor real para avançar a chave mesmo com empate no tempo
        // regulamentar. A ESPN marca `winner: true` no competidor vencedor.
        let winnerTeamId: string | null = null;
        if (isFinished) {
          const winnerComp = (scoreCompetitors as any[]).find((c) => c?.winner === true)
            ?? (competitors as any[]).find((c) => c?.winner === true);
          const winnerCode = (winnerComp?.team?.abbreviation ?? "").toUpperCase();
          if (winnerCode === homeCode) winnerTeamId = m.home_team_id;
          else if (winnerCode === awayCode) winnerTeamId = m.away_team_id;
          // Fallback: se não houver flag de vencedor, usa diferença no placar regulamentar
          if (!winnerTeamId && h !== a) {
            winnerTeamId = h > a ? m.home_team_id : m.away_team_id;
          }
        }
        await supabaseAdmin
          .from("knockout_matches")
          .update({
            home_score: h,
            away_score: a,
            finished: isFinished,
            ...(winnerTeamId ? { winner_team_id: winnerTeamId } : {}),
          })
          .eq("round", knockoutRef[1].toUpperCase() as any)
          .eq("position", Number(knockoutRef[2]));
      }

      if (uerr) {
        results.push({ id: m.id, error: uerr.message });
      } else {
        updated++;
        results.push({
          id: m.id,
          home: h,
          away: a,
          finished: isFinished,
          status: statusName,
          clock,
          period,
        });
      }
    }

    return Response.json({
      updated,
      events: events.length,
      candidates: matches?.length ?? 0,
      results,
    });
  } catch (e: any) {
    return Response.json(
      { error: "exception", message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
