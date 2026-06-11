import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PointsPaymentStatus = {
  user_id: string;
  status: string;
};

export const getAllPointsPaymentStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("user_id,status")
      .eq("mode", "points");

    if (error) throw new Error(error.message);

    return (data ?? []) as PointsPaymentStatus[];
  });