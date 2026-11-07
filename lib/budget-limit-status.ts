// Determine status from integer sen, not rounded percentage. With two-decimal
// IDR inputs, floating point addition (0.1 + 0.2) must not count as overspend.
export type BudgetLimitStatus = "normal" | "near" | "at_limit" | "over";

export function getBudgetLimitStatus(
  planned: number,
  spent: number,
): BudgetLimitStatus {
  if (!Number.isFinite(planned) || !Number.isFinite(spent)) return "normal";
  const plannedSen = Math.round(planned * 100);
  const spentSen = Math.round(spent * 100);
  if (spentSen > plannedSen) return "over";
  if (plannedSen > 0 && spentSen === plannedSen) return "at_limit";
  if (plannedSen > 0 && spentSen / plannedSen >= 0.9) return "near";
  return "normal";
}
