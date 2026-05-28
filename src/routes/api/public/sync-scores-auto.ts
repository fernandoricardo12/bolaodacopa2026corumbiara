import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Sincronização automática usando a API pública da ESPN (sem chave).
// Casa pelos códigos FIFA das seleções + data do jogo (janela de 36h).
const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const FINISHED_STATUSES = new Set([
  "STATUS_FINAL",
  "STATUS_FULL_TIME",
  "STATUS_ENDED",
  "STATUS_AET",
  "STATUS_PEN",
]);

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
    // 1) Busca placares ao vivo na ESPN
    const res = await fetch(ESPN_URL, {
      headers: { "user-agent": "Mozilla/5.0 BolaoCopa2026" },
    });
    if (!res.ok) {
      return Response.json(
        { error: "espn_fetch_failed", status: res.status },
        { status: 502 },
      );
    }
    const json: any = await res.json();
    const events: any[] = Array.isArray(json?.events) ? json.events : [];

    // 2) Pega jogos do banco que ainda não terminaram
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, kickoff, finished, home_team_id, away_team_id, home_score, away_score",
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
      const isFinished = FINISHED_STATUSES.has(statusName);

      const competitors = comp.competitors ?? [];
      const findScore = (code: string) => {
        const c = competitors.find(
          (x: any) => (x?.team?.abbreviation ?? "").toUpperCase() === code,
        );
        const s = c?.score;
        const n = s === undefined || s === null || s === "" ? null : Number(s);
        return Number.isFinite(n as number) ? (n as number) : null;
      };
      const h = findScore(homeCode);
      const a = findScore(awayCode);
      if (h === null || a === null) continue;

      // Só atualiza se mudou algo
      if (h === m.home_score && a === m.away_score && isFinished === m.finished) {
        results.push({ id: m.id, skipped: "no-change", status: statusName });
        continue;
      }

      const { error: uerr } = await supabaseAdmin
        .from("matches")
        .update({
          home_score: h,
          away_score: a,
          finished: isFinished,
        })
        .eq("id", m.id);

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
