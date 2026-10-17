import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

interface LedgerSummaryPillProps {
  // Real month totals from computeMonthIncomeExpense (transfers excluded).
  income: number;
  expense: number;
  // Indonesian month label, e.g. "Oktober 2026".
  monthLabel: string;
  // The month summary could not be computed; show a quiet notice, not numbers.
  incomplete: boolean;
}

// Quick ledger summary for the active month: total income (emerald, +Rp) and
// total expense (red, -Rp). The figures come straight from the real month
// query; meaning is carried by label + glyph + sign + tone together, never
// color alone. A one-line note states this summarizes the whole month, so it is
// not misread as a filtered total.
export function LedgerSummaryPill({
  income,
  expense,
  monthLabel,
  incomplete,
}: LedgerSummaryPillProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <div className="flex flex-col gap-0.5">
        <span className="text-label-xs uppercase text-on-surface-variant">
          Ringkasan {monthLabel}
        </span>
        <span className="text-label-md text-on-surface-variant">
          Total sepanjang bulan, bukan hasil filter.
        </span>
      </div>

      {incomplete ? (
        <p role="alert" className="text-body-sm text-on-surface-variant">
          Ringkasan bulan ini belum bisa dimuat. Coba muat ulang.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-2.5">
            <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
              <Icon name="arrow_downward" size={16} className="text-income" />
              Total Pemasukan
            </span>
            <AmountText
              value={income}
              tone="income"
              size="none"
              signed
              className="text-title-md font-semibold tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-2.5">
            <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
              <Icon name="arrow_upward" size={16} className="text-expense" />
              Total Pengeluaran
            </span>
            <AmountText
              value={-expense}
              tone="expense"
              size="none"
              signed
              className="text-title-md font-semibold tabular-nums"
            />
          </div>
        </div>
      )}
    </section>
  );
}
