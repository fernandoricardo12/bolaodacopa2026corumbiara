import { createFileRoute } from "@tanstack/react-router";

// Sincroniza automaticamente o mata-mata pela chave oficial FIFA/ESPN.
// O ponto principal aqui é NÃO montar as oitavas em pares sequenciais.
// No formato 2026, os vencedores dos 16 avos seguem um cruzamento fixo:
// M89 = W74 x W77, M90 = W73 x W75, M91 = W76 x W78, etc.

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const SUMMARY_URL =
  "https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";

type KoRound = "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";

type BracketMatch = {
  round: KoRound;
  position: number;
  label: string;
  fifaMatch: number;
  espnId: string;
  kickoff: string;
  home_source: string;
  away_source: string;
  venue?: string | null;
};

const ROUND_OF_32: BracketMatch[] = [
  { round: "R32", position: 1, label: "Jogo 73", fifaMatch: 73, espnId: "760486", kickoff: "2026-06-28T19:00:00Z", home_source: "2º Grupo A", away_source: "2º Grupo B", venue: "Los Angeles" },
  { round: "R32", position: 2, label: "Jogo 76", fifaMatch: 76, espnId: "760487", kickoff: "2026-06-29T17:00:00Z", home_source: "1º Grupo C", away_source: "2º Grupo F", venue: "Houston" },
  { round: "R32", position: 3, label: "Jogo 74", fifaMatch: 74, espnId: "760489", kickoff: "2026-06-29T20:30:00Z", home_source: "1º Grupo E", away_source: "3º Grupo D", venue: "Foxborough" },
  { round: "R32", position: 4, label: "Jogo 75", fifaMatch: 75, espnId: "760488", kickoff: "2026-06-30T01:00:00Z", home_source: "1º Grupo F", away_source: "2º Grupo C", venue: "Guadalupe" },
  { round: "R32", position: 5, label: "Jogo 78", fifaMatch: 78, espnId: "760490", kickoff: "2026-06-30T17:00:00Z", home_source: "2º Grupo E", away_source: "2º Grupo I", venue: "Arlington" },
  { round: "R32", position: 6, label: "Jogo 77", fifaMatch: 77, espnId: "760492", kickoff: "2026-06-30T21:00:00Z", home_source: "1º Grupo I", away_source: "3º Grupo F", venue: "East Rutherford" },
  { round: "R32", position: 7, label: "Jogo 79", fifaMatch: 79, espnId: "760491", kickoff: "2026-07-01T01:00:00Z", home_source: "1º Grupo A", away_source: "3º Grupo E", venue: "Cidade do México" },
  { round: "R32", position: 8, label: "Jogo 80", fifaMatch: 80, espnId: "760495", kickoff: "2026-07-01T16:00:00Z", home_source: "1º Grupo L", away_source: "3º Grupo K", venue: "Atlanta" },
  { round: "R32", position: 9, label: "Jogo 82", fifaMatch: 82, espnId: "760493", kickoff: "2026-07-01T20:00:00Z", home_source: "1º Grupo G", away_source: "3º Grupo I", venue: "Seattle" },
  { round: "R32", position: 10, label: "Jogo 81", fifaMatch: 81, espnId: "760494", kickoff: "2026-07-02T00:00:00Z", home_source: "1º Grupo D", away_source: "3º Grupo B", venue: "Santa Clara" },
  { round: "R32", position: 11, label: "Jogo 84", fifaMatch: 84, espnId: "760497", kickoff: "2026-07-02T19:00:00Z", home_source: "1º Grupo H", away_source: "2º Grupo J", venue: "Inglewood" },
  { round: "R32", position: 12, label: "Jogo 83", fifaMatch: 83, espnId: "760496", kickoff: "2026-07-02T23:00:00Z", home_source: "2º Grupo K", away_source: "2º Grupo L", venue: "Toronto" },
  { round: "R32", position: 13, label: "Jogo 85", fifaMatch: 85, espnId: "760498", kickoff: "2026-07-03T03:00:00Z", home_source: "1º Grupo B", away_source: "3º Grupo J", venue: "Vancouver" },
  { round: "R32", position: 14, label: "Jogo 88", fifaMatch: 88, espnId: "760499", kickoff: "2026-07-03T18:00:00Z", home_source: "2º Grupo D", away_source: "2º Grupo G", venue: "Arlington" },
  { round: "R32", position: 15, label: "Jogo 86", fifaMatch: 86, espnId: "760500", kickoff: "2026-07-03T22:00:00Z", home_source: "1º Grupo J", away_source: "2º Grupo H", venue: "Miami Gardens" },
  { round: "R32", position: 16, label: "Jogo 87", fifaMatch: 87, espnId: "760501", kickoff: "2026-07-04T01:30:00Z", home_source: "1º Grupo K", away_source: "3º Grupo L", venue: "Kansas City" },
];

const OFFICIAL_BRACKET: BracketMatch[] = [
  ...ROUND_OF_32,
  { round: "R16", position: 1, label: "Jogo 89", fifaMatch: 89, espnId: "760503", kickoff: "2026-07-04T21:00:00Z", home_source: "W:R32-3", away_source: "W:R32-6", venue: "Philadelphia" },
  { round: "R16", position: 2, label: "Jogo 90", fifaMatch: 90, espnId: "760502", kickoff: "2026-07-04T17:00:00Z", home_source: "W:R32-1", away_source: "W:R32-4", venue: "Houston" },
  { round: "R16", position: 3, label: "Jogo 91", fifaMatch: 91, espnId: "760504", kickoff: "2026-07-05T20:00:00Z", home_source: "W:R32-2", away_source: "W:R32-5", venue: "East Rutherford" },
  { round: "R16", position: 4, label: "Jogo 92", fifaMatch: 92, espnId: "760505", kickoff: "2026-07-06T00:00:00Z", home_source: "W:R32-7", away_source: "W:R32-8", venue: "Cidade do México" },
  { round: "R16", position: 5, label: "Jogo 93", fifaMatch: 93, espnId: "760506", kickoff: "2026-07-06T19:00:00Z", home_source: "W:R32-12", away_source: "W:R32-11", venue: "Arlington" },
  { round: "R16", position: 6, label: "Jogo 94", fifaMatch: 94, espnId: "760507", kickoff: "2026-07-07T00:00:00Z", home_source: "W:R32-10", away_source: "W:R32-9", venue: "Seattle" },
  { round: "R16", position: 7, label: "Jogo 95", fifaMatch: 95, espnId: "760509", kickoff: "2026-07-07T16:00:00Z", home_source: "W:R32-15", away_source: "W:R32-14", venue: "Atlanta" },
  { round: "R16", position: 8, label: "Jogo 96", fifaMatch: 96, espnId: "760508", kickoff: "2026-07-07T20:00:00Z", home_source: "W:R32-13", away_source: "W:R32-16", venue: "Vancouver" },
  { round: "QF", position: 1, label: "Jogo 97", fifaMatch: 97, espnId: "760510", kickoff: "2026-07-09T20:00:00Z", home_source: "W:R16-1", away_source: "W:R16-2", venue: "Foxborough" },
  { round: "QF", position: 2, label: "Jogo 98", fifaMatch: 98, espnId: "760511", kickoff: "2026-07-10T19:00:00Z", home_source: "W:R16-5", away_source: "W:R16-6", venue: "Inglewood" },
  { round: "QF", position: 3, label: "Jogo 99", fifaMatch: 99, espnId: "760512", kickoff: "2026-07-11T21:00:00Z", home_source: "W:R16-3", away_source: "W:R16-4", venue: "Miami Gardens" },
  { round: "QF", position: 4, label: "Jogo 100", fifaMatch: 100, espnId: "760513", kickoff: "2026-07-12T01:00:00Z", home_source: "W:R16-7", away_source: "W:R16-8", venue: "Kansas City" },
  { round: "SF", position: 1, label: "Jogo 101", fifaMatch: 101, espnId: "760514", kickoff: "2026-07-14T19:00:00Z", home_source: "W:QF-1", away_source: "W:QF-2", venue: "Arlington" },
  { round: "SF", position: 2, label: "Jogo 102", fifaMatch: 102, espnId: "760515", kickoff: "2026-07-15T19:00:00Z", home_source: "W:QF-3", away_source: "W:QF-4", venue: "Atlanta" },
  { round: "THIRD", position: 1, label: "Jogo 103", fifaMatch: 103, espnId: "760516", kickoff: "2026-07-18T21:00:00Z", home_source: "L:SF-1", away_source: "L:SF-2", venue: "Miami Gardens" },
  { round: "FINAL", position: 1, label: "Jogo 104", fifaMatch: 104, espnId: "760517", kickoff: "2026-07-19T19:00:00Z", home_source: "W:SF-1", away_source: "W:SF-2", venue: "East Rutherford" },
];

const ESPN_TO_OURS: Record<string, string> = {
  // ESPN usa algumas siglas/nomes diferentes das cadastradas no banco.
  DZA: "ALG",
  SAU: "KSA",
  HOL: "NED",
  SWI: "SUI",
  CDI: "CIV",
  CIV: "CIV",
  CRC: "COD",
  DRC: "COD",
  RDC: "COD",
  COD: "COD",
  BIH: "BIH",
  CPV: "CPV",
  RSA: "RSA",
  MAR: "MAR",
  PAR: "PAR",
};

export const Route = createFileRoute("/api/public/sync-knockout-auto")({
  server: {
    handlers: {
      GET: async () => handle(),
      POST: async () => handle(),
    },
  },
});

async function handle() {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("teams")
      .select("id, code");
    if (teamsError) return Response.json({ error: teamsError.message }, { status: 500 });

    const codeToId = new Map<string, string>();
    for (const t of teams ?? []) codeToId.set(String(t.code).toUpperCase(), t.id);

    const resolveTeamId = (code: string | null | undefined): string | null => {
      const raw = String(code ?? "").toUpperCase().trim();
      if (!raw || raw === "RD32" || raw === "RD16" || raw === "QF" || raw === "SF") return null;
      const mapped = ESPN_TO_OURS[raw] ?? raw;
      return codeToId.get(mapped) ?? codeToId.get(raw) ?? null;
    };

    const events = await fetchEspnEvents();
    const eventsById = new Map(events.map((e) => [String(e?.id), e]));

    const { data: existingRows, error: koError } = await supabaseAdmin
      .from("knockout_matches")
      .select("round,position,home_team_id,away_team_id,home_score,away_score,finished");
    if (koError) return Response.json({ error: koError.message }, { status: 500 });

    const existing = new Map(
      (existingRows ?? []).map((r: any) => [`${r.round}-${r.position}`, r]),
    );

    const winnerBySource = new Map<string, string>();
    const loserBySource = new Map<string, string>();
    for (const r of existingRows ?? []) {
      const row: any = r;
      if (!row.finished || row.home_score === null || row.away_score === null || !row.home_team_id || !row.away_team_id) continue;
      const h = Number(row.home_score);
      const a = Number(row.away_score);
      if (h === a) continue;
      const winner = h > a ? row.home_team_id : row.away_team_id;
      const loser = h > a ? row.away_team_id : row.home_team_id;
      winnerBySource.set(`W:${row.round}-${row.position}`, winner);
      loserBySource.set(`L:${row.round}-${row.position}`, loser);
    }

    const findAdvancedTeam = (source: string) => {
      if (source.startsWith("W:")) return winnerBySource.get(source) ?? null;
      if (source.startsWith("L:")) return loserBySource.get(source) ?? null;
      return null;
    };

    let upserted = 0;
    let syncedMatches = 0;
    const results: any[] = [];

    for (const spec of OFFICIAL_BRACKET) {
      const existingRow = existing.get(`${spec.round}-${spec.position}`);
      const event = eventsById.get(spec.espnId);
      const competitors = event?.competitions?.[0]?.competitors ?? [];
      const byOrder = [...competitors].sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
      const homeEspnCode = byOrder[0]?.team?.abbreviation;
      const awayEspnCode = byOrder[1]?.team?.abbreviation;

      const patch: Record<string, any> = {
        round: spec.round,
        position: spec.position,
        label: spec.label,
        home_source: spec.home_source,
        away_source: spec.away_source,
        kickoff: spec.kickoff,
        venue: spec.venue ?? null,
      };

      const homeFromEspn = resolveTeamId(homeEspnCode);
      const awayFromEspn = resolveTeamId(awayEspnCode);
      const homeFromSource = findAdvancedTeam(spec.home_source);
      const awayFromSource = findAdvancedTeam(spec.away_source);

      patch.home_team_id = homeFromEspn ?? homeFromSource ?? existingRow?.home_team_id ?? null;
      patch.away_team_id = awayFromEspn ?? awayFromSource ?? existingRow?.away_team_id ?? null;

      // Não deixe dados antigos contradizerem a chave oficial. Se uma vaga ainda
      // depende de jogo futuro e a ESPN/fonte não definiu o time, limpamos o slot.
      if (!homeFromEspn && !homeFromSource && spec.home_source.startsWith("W:")) patch.home_team_id = null;
      if (!awayFromEspn && !awayFromSource && spec.away_source.startsWith("W:")) patch.away_team_id = null;
      if (!homeFromEspn && !homeFromSource && spec.home_source.startsWith("L:")) patch.home_team_id = null;
      if (!awayFromEspn && !awayFromSource && spec.away_source.startsWith("L:")) patch.away_team_id = null;

      const { error: upsertError } = await supabaseAdmin
        .from("knockout_matches")
        .upsert(patch as any, { onConflict: "round,position" });
      if (upsertError) {
        results.push({ round: spec.round, position: spec.position, error: upsertError.message });
        continue;
      }
      upserted++;

      // O trigger cria/atualiza `matches` usando external_match_id ko:ROUND-POSITION.
      // Mantemos esse identificador interno para que a sincronização de placares
      // consiga refletir o resultado de volta em `knockout_matches` e avançar a chave.
      if (patch.home_team_id && patch.away_team_id && patch.home_team_id !== patch.away_team_id) {
        const koExternalId = `ko:${spec.round}-${spec.position}`;
        const { error: matchError } = await supabaseAdmin
          .from("matches")
          .update({ kickoff: spec.kickoff, venue: spec.venue ?? null })
          .eq("external_match_id", koExternalId);
        if (!matchError) syncedMatches++;
      }

      results.push({
        round: spec.round,
        position: spec.position,
        fifaMatch: spec.fifaMatch,
        home_source: spec.home_source,
        away_source: spec.away_source,
        home_set: !!patch.home_team_id,
        away_set: !!patch.away_team_id,
      });
    }

    return Response.json({
      source: "official_fifa_espn_bracket",
      upserted,
      syncedMatches,
      espnEvents: events.length,
      note: "Oitavas corrigidas: o Brasil segue para o Jogo 91 contra o vencedor do Jogo 78, não contra o Canadá.",
      results,
    });
  } catch (e: any) {
    return Response.json(
      { error: "exception", message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}

async function fetchEspnEvents() {
  const events: any[] = [];
  try {
    const res = await fetch(SCOREBOARD_URL, {
      headers: { "user-agent": "Mozilla/5.0 BolaoCopa2026" },
    });
    if (res.ok) {
      const json: any = await res.json();
      if (Array.isArray(json?.events)) events.push(...json.events);
    }
  } catch {
    // Continuamos com summaries abaixo.
  }

  const existingIds = new Set(events.map((e) => String(e?.id)));
  await Promise.all(
    OFFICIAL_BRACKET.map(async (spec) => {
      if (existingIds.has(spec.espnId)) return;
      try {
        const res = await fetch(`${SUMMARY_URL}${spec.espnId}`, {
          headers: { "user-agent": "Mozilla/5.0 BolaoCopa2026" },
        });
        if (!res.ok) return;
        const json: any = await res.json();
        const header = json?.header;
        const competition = header?.competitions?.[0];
        if (header && competition) {
          events.push({
            id: header.id ?? spec.espnId,
            date: competition.date,
            competitions: [competition],
            status: competition.status,
          });
        }
      } catch {
        // Ignora falha de um jogo específico.
      }
    }),
  );

  return events;
}
