export const POINTS_WINNER_SHARE = 0.8;
export const POINTS_ADMIN_BONUS = 100;

export function calculatePointsPrize(totalCollected: number) {
  const safeTotal = Number.isFinite(totalCollected) ? totalCollected : 0;
  const poolPrize = safeTotal * POINTS_WINNER_SHARE;
  const adminFee = safeTotal * (1 - POINTS_WINNER_SHARE);
  const finalPrize = poolPrize + POINTS_ADMIN_BONUS;

  return {
    totalCollected: safeTotal,
    poolPrize,
    adminFee,
    bonus: POINTS_ADMIN_BONUS,
    finalPrize,
  };
}