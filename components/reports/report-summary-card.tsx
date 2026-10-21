import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

interface ReportSummaryCardProps {
  monthLabel: string;
  income: number;
  expense: number;
  // Computed by the page as income - expense; never recomputed here.
  net: number;
  // The month summary query failed; show a quiet notice instead of zeros.
  incomplete: boolean;
}

// Hero card for the selected month. The Selisih is the focal figure: it answers
// "did I spend less than I earned". Meaning is carried by label + sign + glyph
// + tone together, never color alone.
export function ReportSummaryCard({
  monthLabel,
  income,
  expense,
  net,
  incomplete,
}: ReportSummaryCardProps) {
  return (
    <section
      aria-label="Ringkasan bulan"
      className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm"
    >
      <span className="text-label-xs uppercase text-on-surface-variant">
        Ringkasan {monthLabel}
      </span>

      {incomplete ? (
        <p role="alert" className="text-body-sm text-on-surface-variant">
          Ringkasan belum bisa dimuat. Coba muat ulang.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
              <Icon name="account_balance_wallet" size={16} />
              Selisih
            </span>
            {/* 24px at 320px so +Rp1.234.567.890 fits the card; 28px from
                375px. Size sits on the wrapper because tailwind-merge reads
                the custom text-* size keys as colors and would drop the tone. */}
            <span className="text-headline-lg min-[375px]:text-currency-display">
              <AmountText
                value={net}
                signed
                tone={net > 0 ? "income" : net < 0 ? "expense" : "default"}
                size="none"
              />
            </span>
          </div>

          {/* Stacked rows, not a 2-column grid, so long amounts never squeeze
              at 320px. */}
          <div className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3">
            <SummaryRow
              glyph="arrow_downward"
              label="Pemasukan"
              value={income}
              tone="income"
            />
            <SummaryRow
              glyph="arrow_upward"
              label="Pengeluaran"
              value={-expense}
              tone="expense"
            />
          </div>
        </>
      )}
    </section>
  );
}

function SummaryRow({
  glyph,
  label,
  value,
  tone,
}: {
  glyph: string;
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
        <Icon
          name={glyph}
          size={16}
          className={tone === "income" ? "text-income" : "text-expense"}
        />
        {label}
      </span>
      <span className="ml-auto text-title-md font-semibold">
        <AmountText value={value} tone={tone} size="none" signed />
      </span>
    </div>
  );
}
