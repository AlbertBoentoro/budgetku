import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { AmountText } from "@/components/finance/amount-text";

export interface BudgetVsActualRow {
  categoryName: string;
  planned: number;
  spent: number;
  remaining: number; // planned - spent (negative when over budget)
  isOverBudget: boolean;
  barPercent: number; // clamp(spent/planned * 100, 0, 100) — bar width only
}

interface BudgetVsActualListProps {
  rows: BudgetVsActualRow[];
}

// Compares planned vs spent per category for the selected month. The bar width
// is purely visual; planned, spent, and over/under are always printed as text
// with an explicit sign, so status never relies on color alone. This mirrors
// the budget page's item-row language but stays read-only (no edit/delete), so
// it needs no client interactivity.
export function BudgetVsActualList({ rows }: BudgetVsActualListProps) {
  return (
    <ul className="flex flex-col divide-y rounded-2xl border bg-card">
      {rows.map((row) => (
        <li key={row.categoryName} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate font-medium">
              {row.categoryName}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              <AmountText value={row.spent} size="sm" /> /{" "}
              <AmountText value={row.planned} size="sm" />
            </span>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-full",
                row.isOverBudget ? "bg-expense" : "bg-primary",
              )}
              style={{ width: `${row.barPercent}%` }}
            />
          </div>

          {row.isOverBudget ? (
            <span className="flex items-center gap-1.5 text-sm text-expense">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Lebih <AmountText value={-row.remaining} size="sm" tone="expense" />
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Sisa <AmountText value={row.remaining} size="sm" />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
