/**
 * Link one budget category to the existing transaction ledger, scoped to the
 * selected budget month and expense-only entries (the same definition used by
 * computeCategorySpending). Query parameters are encoded, never interpolated.
 */
export function budgetCategoryHistoryHref(
  categoryId: string,
  monthParam: string,
): string {
  const params = new URLSearchParams({
    type: "expense",
    category: categoryId,
    month: monthParam,
  });
  return `/transactions?${params.toString()}`;
}
