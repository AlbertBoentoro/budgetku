import Link from "next/link";

import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

interface BudgetOverviewCardProps {
  monthLabel: string;
  hasBudget: boolean;
  planned: number;
  spent: number;
  remaining: number;
  // Clamped 0-100 ratio of spent/planned; presentation of a real ratio.
  barPercent: number;
  // When true the spending figures could not be fully computed; do not present
  // spent/remaining as final.
  incomplete: boolean;
  // Link target for creating a budget for this month, e.g.
  // "/budget/new?month=2026-10".
  createHref: string;
}

// Monthly budget summary card. All numbers are real (planned/spent/remaining
// from the budget compose; pct derived from the real spent/planned ratio).
// When no budget exists for the month it renders an honest empty state with a
// link to create one.
export function BudgetOverviewCard({
  monthLabel,
  hasBudget,
  planned,
  spent,
  remaining,
  barPercent,
  incomplete,
  createHref,
}: BudgetOverviewCardProps) {
  const pct = Math.round(barPercent);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="track_changes" size={20} className="text-on-surface-variant" />
          <h2 className="text-title-md text-on-surface">Anggaran {monthLabel}</h2>
        </div>
        <Link
          href="/budget"
          className="rounded-md px-1 text-label-md text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Detail
        </Link>
      </div>

      {!hasBudget ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body-sm text-on-surface-variant">
            Belum ada anggaran bulan ini.
          </p>
          <Link
            href={createHref}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-label-md text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Icon name="add" size={18} />
            Buat anggaran
          </Link>
        </div>
      ) : (
        <>
          <p className="text-body-sm text-on-surface-variant">
            Terpakai{" "}
            <AmountText value={spent} size="none" className="text-currency-body" />{" "}
            dari{" "}
            <AmountText value={planned} size="none" className="text-currency-body" />
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Pemakaian anggaran ${pct} persen`}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${barPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-on-surface-variant">{pct}% terpakai</span>
            <span className="text-on-surface-variant">
              Sisa{" "}
              <AmountText
                value={remaining}
                size="none"
                className="text-currency-body"
              />
            </span>
          </div>
          {incomplete ? (
            <p className="text-label-md text-on-surface-variant">
              Pemakaian belum dapat dihitung sepenuhnya.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
