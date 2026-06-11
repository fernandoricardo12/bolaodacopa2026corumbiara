import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PointsPaymentStatus = {
  user_id: string;
  status: "confirmed" | "pending";
  display_name: string | null;
  avatar_url: string | null;
};

export const getAllPointsPaymentStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("user_id,status,created_at")
      .eq("mode", "points")
      .in("status", ["confirmed", "pending"])
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const byUser = new Map<string, "confirmed" | "pending">();
    for (const payment of data ?? []) {
      if (payment.status !== "confirmed" && payment.status !== "pending") continue;
      const current = byUser.get(payment.user_id);
      if (current === "confirmed") continue;
      byUser.set(payment.user_id, payment.status === "confirmed" ? "confirmed" : "pending");
    }

    const userIds = Array.from(byUser.keys());
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,display_name,avatar_url").in("id", userIds)
      : { data: [], error: null };

    if (profilesError) throw new Error(profilesError.message);

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return userIds.map((userId) => {
      const profile = profileById.get(userId);
      return {
        user_id: userId,
        status: byUser.get(userId)!,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      } satisfies PointsPaymentStatus;
    });
  });