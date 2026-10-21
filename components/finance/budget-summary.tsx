import type { BudgetTotals } from "@/lib/budgets";
import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

interface BudgetSummaryProps {
  totals: BudgetTotals;
  // True when per-category spending could not be computed, so the spent/remaining
  // numbers are incomplete and should not be presented as final.
  incomplete?: boolean;
}

export function BudgetSummary({ totals, incomplete = false }: BudgetSummaryProps) {
  // Real ratio of spent/planned, clamped for the bar width only. Guard the
  // divide so a zero/empty plan never produces NaN (mirrors the inline clamp in
  // budget-overview-card).
  const barPercent =
    totals.planned > 0
      ? Math.max(0, Math.min(100, (totals.spent / totals.planned) * 100))
      : 0;
  const pct = Math.round(barPercent);

  return (
    <section
      aria-label="Ringkasan anggaran"
      className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-lg shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-label-xs uppercase text-on-surface-variant">
            Total Anggaran Bulanan
          </span>
          <AmountText
            value={totals.planned}
            size="none"
            className="text-headline-lg text-on-surface"
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-label-xs uppercase text-on-surface-variant">
            Sisa Tersedia
          </span>
          {/* Over-budget remaining is negative: the native minus sign + red tone
              carry the meaning, never color alone. */}
          <AmountText
            value={totals.remaining}
            size="none"
            tone={
              totals.isOverBudget
                ? "expense"
                : totals.remaining > 0
                  ? "income"
                  : "default"
            }
            className="text-currency-body"
          />
        </div>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Pemakaian anggaran ${pct} persen`}
      >
        <div
          className={`h-full rounded-full ${totals.isOverBudget ? "bg-expense" : "bg-primary"}`}
          style={{ width: `${barPercent}%` }}
        />
      </div>

      <p className="text-body-sm text-on-surface-variant">
        Terpakai{" "}
        <AmountText value={totals.spent} size="none" className="text-body-sm" />{" "}
        ({pct}%)
      </p>

      {totals.isOverBudget ? (
        <p className="flex items-center gap-1.5 text-body-sm text-expense">
          <Icon name="error" size={16} />
          Pengeluaran melebihi total anggaran.
        </p>
      ) : null}

      {incomplete ? (
        <p className="text-body-sm text-on-surface-variant">
          Pemakaian belum dapat dihitung sepenuhnya. Muat ulang untuk angka
          terbaru.
        </p>
      ) : null}
    </section>
  );
}
