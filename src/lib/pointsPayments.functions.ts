import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PointsPaymentStatus = {
  user_id: string;
  status: "confirmed" | "pending";
  display_name: string | null;
  avatar_url: string | null;
};

export type PointsRankingData = {
  payments: PointsPaymentStatus[];
  bets: { id: string; user_id: string; match_id: string; home_score: number; away_score: number; points: number }[];
  matches: { id: string; kickoff: string; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; finished: boolean; live_status_detail: string | null }[];
  teams: { id: string; name: string; code: string }[];
  profiles: { id: string; display_name: string; avatar_url: string | null; gender?: string | null }[];
};

const PAGE_SIZE = 1000;

function calculateBolaoPoints(bHome: number, bAway: number, rHome: number | null, rAway: number | null) {
  if (rHome === null || rAway === null) return 0;
  const exactScore = bHome === rHome && bAway === rAway;
  if (exactScore) return 20;

  const winnerOk = Math.sign(bHome - bAway) === Math.sign(rHome - rAway);
  const oneScoreOk = bHome === rHome || bAway === rAway;

  if (winnerOk && oneScoreOk) return 15;
  if (winnerOk) return 10;
  if (oneScoreOk) return 5;
  return 0;
}

async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
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

function summarizePointPayments(payments: { user_id: string; status: string }[], profiles: { id: string; display_name: string | null; avatar_url: string | null }[]) {
  const byUser = new Map<string, "confirmed" | "pending">();
  for (const payment of payments) {
    if (payment.status !== "confirmed" && payment.status !== "pending") continue;
    const current = byUser.get(payment.user_id);
    if (current === "confirmed") continue;
    byUser.set(payment.user_id, payment.status === "confirmed" ? "confirmed" : "pending");
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return Array.from(byUser.keys()).map((userId) => {
    const profile = profileById.get(userId);
    return {
      user_id: userId,
      status: byUser.get(userId)!,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    } satisfies PointsPaymentStatus;
  });
}

export const getAllPointsPaymentStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const data = await fetchAllPages<{ user_id: string; status: string; created_at: string }>((from, to) =>
      supabaseAdmin
        .from("payments")
        .select("user_id,status,created_at")
        .eq("mode", "points")
        .in("status", ["confirmed", "pending"])
        .order("created_at", { ascending: false })
        .range(from, to),
    );

    const userIds = Array.from(new Set(data.map((payment) => payment.user_id)));
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,display_name,avatar_url").in("id", userIds)
      : { data: [], error: null };

    if (profilesError) throw new Error(profilesError.message);

    return summarizePointPayments(data, profiles ?? []);
  });

export const getPointsRankingData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [payments, bets, matches, teams, profiles] = await Promise.all([
      fetchAllPages<{ user_id: string; status: string; created_at: string }>((from, to) =>
        supabaseAdmin.from("payments").select("user_id,status,created_at").eq("mode", "points").in("status", ["confirmed", "pending"]).order("created_at", { ascending: false }).range(from, to),
      ),
      fetchAllPages<{ id: string; user_id: string; match_id: string; home_score: number; away_score: number; points: number }>((from, to) =>
        supabaseAdmin.from("bets").select("id,user_id,match_id,home_score,away_score,points").order("id", { ascending: true }).range(from, to),
      ),
      fetchAllPages<PointsRankingData["matches"][number]>((from, to) =>
        supabaseAdmin.from("matches").select("id,kickoff,home_team_id,away_team_id,home_score,away_score,finished,live_status_detail").order("id", { ascending: true }).range(from, to),
      ),
      fetchAllPages<PointsRankingData["teams"][number]>((from, to) =>
        supabaseAdmin.from("teams").select("id,name,code").order("id", { ascending: true }).range(from, to),
      ),
      fetchAllPages<PointsRankingData["profiles"][number]>((from, to) =>
        supabaseAdmin.from("profiles").select("id,display_name,avatar_url,gender").order("id", { ascending: true }).range(from, to),
      ),
    ]);

    const matchById = new Map(matches.map((match) => [match.id, match]));
    const liveBets = bets.map((bet) => {
      const match = matchById.get(bet.match_id);
      return {
        ...bet,
        points: calculateBolaoPoints(bet.home_score, bet.away_score, match?.home_score ?? null, match?.away_score ?? null),
      };
    });

    return {
      payments: summarizePointPayments(payments, profiles),
      bets: liveBets,
      matches,
      teams,
      profiles,
    } satisfies PointsRankingData;
  });