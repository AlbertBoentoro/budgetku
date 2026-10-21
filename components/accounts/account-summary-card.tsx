import Link from "next/link";

import { cn } from "@/lib/utils";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface AccountSummaryCardProps {
  // Sum of running balances over accounts flagged include_in_total, regardless
  // of archived state. Same rule as the dashboard grand total.
  total: number;
  // Count of non-archived accounts. A distinct real number from the total's
  // include_in_total set; the two are intentionally not conflated.
  activeCount: number;
  // True when the transactions fetch failed and balances fell back to
  // initial_balance, so the figures may be incomplete.
  balancesIncomplete: boolean;
}

// Stitch summary card for the Rekening screen. Presentational: the total and
// count are real, server-computed numbers passed in as props (no client fetch).
// Negative total shows the native minus + red tone so meaning is not color
// alone. The mockup's "Transfer Antar Akun" and "Sesuaikan Saldo" quick buttons
// are omitted because those features are not built yet.
export function AccountSummaryCard({
  total,
  activeCount,
  balancesIncomplete,
}: AccountSummaryCardProps) {
  const isNegative = total < 0;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <div className="flex flex-col gap-1">
        <span className="text-label-xs uppercase text-on-surface-variant">
          Total Saldo Akun
        </span>
        {/* text-on-surface only when non-negative: tailwind-merge keeps the
            last text color, so passing it always dropped the expense tone. */}
        <AmountText
          value={total}
          size="none"
          tone={isNegative ? "expense" : "default"}
          className={cn(
            "text-[2.75rem] font-bold leading-[1.1] tracking-tight",
            !isNegative && "text-on-surface",
          )}
        />
        <span className="text-body-sm text-on-surface-variant">
          {activeCount} Akun Aktif
        </span>
      </div>

      {balancesIncomplete ? (
        <p role="alert" className="text-body-sm text-on-surface-variant">
          Saldo mungkin belum lengkap. Coba muat ulang.
        </p>
      ) : null}

      <Button asChild className="h-11 w-full">
        <Link href="/accounts/new">
          <Icon name="add" size={20} />
          Tambah
        </Link>
      </Button>
    </section>
  );
}
