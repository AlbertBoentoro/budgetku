import { AlertTriangle } from "lucide-react";

import type { BudgetTotals } from "@/lib/budgets";
import { AmountText } from "@/components/finance/amount-text";

interface BudgetSummaryProps {
  totals: BudgetTotals;
  // True when per-category spending could not be computed, so the spent/remaining
  // numbers are incomplete and should not be presented as final.
  incomplete?: boolean;
}

export function BudgetSummary({ totals, incomplete = false }: BudgetSummaryProps) {
  return (
    <section
      aria-label="Ringkasan anggaran"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Rencana</span>
        <AmountText value={totals.planned} size="lg" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Terpakai</span>
          <AmountText value={totals.spent} size="md" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Sisa</span>
          {totals.isOverBudget ? (
            <span className="flex items-center gap-1.5 text-expense">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <AmountText value={totals.remaining} size="md" tone="expense" />
            </span>
          ) : (
            <AmountText value={totals.remaining} size="md" />
          )}
        </div>
      </div>

      {totals.isOverBudget ? (
        <p className="flex items-center gap-1.5 text-sm text-expense">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Pengeluaran sudah melebihi total anggaran.
        </p>
      ) : null}

      {incomplete ? (
        <p className="text-sm text-muted-foreground">
          Pemakaian belum dapat dihitung sepenuhnya. Muat ulang untuk angka
          terbaru.
        </p>
      ) : null}
    </section>
  );
}
