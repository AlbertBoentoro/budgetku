// Keep status labels tied to actual amounts rather than rounded display %.
// The UI cannot call a 100%-spent budget "near" its limit.
export type BudgetLimitStatus = "normal" | "near" | "at_limit" | "over";

export function getBudgetLimitStatus(
  planned: number,
  spent: number,
): BudgetLimitStatus {
  if (spent > planned) return "over";
  if (planned > 0 && spent === planned) return "at_limit";
  if (planned > 0 && spent / planned >= 0.9) return "near";
  return "normal";
}
