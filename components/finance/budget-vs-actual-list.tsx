import { cn } from "@/lib/utils";
import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

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
    <ul className="flex flex-col divide-y divide-outline-variant rounded-xl bg-surface-container-lowest shadow-sm">
      {rows.map((row) => (
        <li key={row.categoryName} className="flex flex-col gap-2 px-4 py-3">
          {/* Wraps on narrow screens so long IDR amounts drop under the name
              instead of overflowing at 320px. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* Neutral glyph: stored category icons are unvalidated, same as
                budget-item-row. */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <Icon name="category" size={20} />
            </span>
            <span className="min-w-0 flex-1 truncate text-body-md text-on-surface">
              {row.categoryName}
            </span>
            {/* Font sizes sit on wrappers: tailwind-merge reads the project's
                custom text-* size keys as colors, so passing size and color
                together to AmountText would drop one of them. */}
            <span className="ml-auto flex shrink-0 flex-col items-end text-right">
              <span className="text-currency-body">
                <AmountText
                  value={row.spent}
                  size="none"
                  className="text-on-surface"
                />
              </span>
              <span className="text-label-md text-on-surface-variant">
                dari{" "}
                <AmountText
                  value={row.planned}
                  size="none"
                  className="text-on-surface-variant"
                />
              </span>
            </span>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low"
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

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-body-sm">
            {/* barPercent is clamped to 100, so the percent is shown only while
                within budget; over budget the exact excess is printed instead. */}
            {row.isOverBudget ? null : (
              <span className="text-on-surface-variant tabular-nums">
                {Math.round(row.barPercent)}% terpakai
              </span>
            )}
            {row.isOverBudget ? (
              <span className="inline-flex items-center gap-1 text-expense">
                <Icon name="error" size={16} />
                Lebih{" "}
                <AmountText value={-row.remaining} tone="expense" size="none" />
              </span>
            ) : (
              <span className="text-on-surface-variant">
                Sisa{" "}
                <AmountText
                  value={row.remaining}
                  size="none"
                  className="text-on-surface-variant"
                />
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
