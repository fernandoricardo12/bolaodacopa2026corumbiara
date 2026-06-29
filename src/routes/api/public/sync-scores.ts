import { createFileRoute } from "@tanstack/react-router";

const RAPIDAPI_HOST = "free-api-live-football-data.p.rapidapi.com";
const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "third", "final"]);

async function fetchMatchScore(eventId: string, apiKey: string) {
  const url = `https://${RAPIDAPI_HOST}/football-get-match-stats?eventid=${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": apiKey,
    },
  });
  if (!res.ok) return null;
  const json: any = await res.json().catch(() => null);
  // Try common shapes
  const r = json?.response ?? json?.data ?? json;
  const home = r?.home?.score ?? r?.homeScore ?? r?.score?.home ?? null;
  const away = r?.away?.score ?? r?.awayScore ?? r?.score?.away ?? null;
  const status: string = (r?.status?.name ?? r?.status ?? "").toString().toLowerCase();
  if (["scheduled", "pre", "not started", "notstarted", "postponed", "delayed"].some((s) => status.includes(s))) return null;
  const finished = ["finished", "ft", "ended", "full-time", "aet", "pen"].some((s) => status.includes(s));
  if (typeof home !== "number" || typeof away !== "number") return null;
  return { home, away, finished };
}

export const Route = createFileRoute("/api/public/sync-scores")({
  server: {
    handlers: {
      GET: async () => handle(),
      POST: async () => handle(),
    },
  },
});

async function handle() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const apiKey = process.env.RAPIDAPI_FOOTBALL_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "missing_key" }), { status: 500 });

  const { data: matches, error } = await supabaseAdmin
    .from("matches")
    .select("id, external_match_id, stage, finished")
    .eq("finished", false)
    .not("external_match_id", "is", null);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let updated = 0;
  const results: any[] = [];
  for (const m of matches ?? []) {
    if (!m.external_match_id) continue;
    if (String(m.external_match_id).startsWith("ko:") || KNOCKOUT_STAGES.has(String(m.stage ?? "").toLowerCase())) {
      results.push({ id: m.id, skipped: true, reason: "knockout_uses_regulation_time_sync" });
      continue;
    }
    const score = await fetchMatchScore(m.external_match_id, apiKey);
    if (!score) { results.push({ id: m.id, skipped: true }); continue; }
    const { error: uerr } = await supabaseAdmin
      .from("matches")
      .update({ home_score: score.home, away_score: score.away, finished: score.finished })
      .eq("id", m.id);
    if (!uerr) { updated++; results.push({ id: m.id, ...score }); }
    else results.push({ id: m.id, error: uerr.message });
  }
  return Response.json({ updated, total: matches?.length ?? 0, results });
}
