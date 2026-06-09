import { createServerFn } from "@tanstack/react-start";
import { calculatePointsPrize } from "./prizeRules";

export const getPointsPrizeSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("amount")
    .eq("mode", "points")
    .eq("status", "confirmed");

  if (error) throw new Error(error.message);

  const totalCollected = (data ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  return calculatePointsPrize(totalCollected);
});