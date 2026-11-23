import Link from "next/link";
import { notFound } from "next/navigation";

import { isPublicTestingDemoAllowed } from "@/lib/auth/public-testing-demo";
import {
  DEMO_BUDGET_LIMITS,
  DEMO_BUDGET_TRANSACTIONS,
  DEMO_EXPENSE_CATEGORIES,
} from "@/lib/testing/demo-budgetku-data";
import { computeItemUsage, formatMonthLabel } from "@/lib/budgets";
import { getBudgetLimitStatus } from "@/lib/budget-limit-status";
import { BudgetSummary } from "@/components/finance/budget-summary";
import { AmountText } from "@/components/finance/amount-text";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Icon } from "@/components/ui/icon";

const DEMO_MONTH = "2026-11";

const statusLabels = {
  normal: "Normal",
  near: "Mendekati batas",
  at_limit: "Di batas",
  over: "Melebihi batas",
} as const;

function demoBudgetItems() {
  return DEMO_BUDGET_LIMITS.map(({ categoryName, plannedAmount }) => {
    const category = DEMO_EXPENSE_CATEGORIES.find((cat) => cat.name === categoryName);
    if (!category) throw new Error(`Kategori demo tidak ditemukan: ${categoryName}`);

    const spent = DEMO_BUDGET_TRANSACTIONS.filter(
      (transaction) =>
        transaction.transaction_type === "expense" &&
        transaction.category_id === category.id &&
        transaction.transaction_at.startsWith(DEMO_MONTH),
    ).reduce((total, transaction) => total + transaction.amount, 0);

    return {
      category,
      usage: computeItemUsage(plannedAmount, spent),
      status: getBudgetLimitStatus(plannedAmount, spent),
    };
  });
}

/** No-auth synthetic gallery, never reads or writes the staging database. */
export default function TestingBudgetPage() {
  if (!isPublicTestingDemoAllowed()) notFound();

  const items = demoBudgetItems();
  const planned = items.reduce((sum, item) => sum + item.usage.planned, 0);
  const spent = items.reduce((sum, item) => sum + item.usage.spent, 0);

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader
        title="Anggaran (Demo)"
        titleAction={<AppBackLink href="/testing" label="Kembali ke testing" />}
      />
      <PageContainer>
        <div className="flex flex-col gap-6">
          <p className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface">
            <strong>Data dummy · tanpa login · hanya preview.</strong> Ketuk nama kategori
            untuk melihat daftar transaksi yang membentuk nominal terpakai.
            Data ini bukan saldo atau transaksi asli dan tidak dapat diubah.
          </p>

          <p className="flex items-center gap-2 text-title-md font-semibold text-on-surface">
            <Icon name="calendar_month" size={20} />
            {formatMonthLabel(DEMO_MONTH)}
          </p>

          <BudgetSummary
            totals={{
              planned,
              spent,
              remaining: planned - spent,
              isOverBudget: spent > planned,
            }}
          />

          <section className="flex flex-col gap-3" aria-labelledby="demo-budget-items-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="demo-budget-items-heading" className="text-title-md font-semibold text-on-surface">
                Batas Pengeluaran Kategori
              </h2>
              <span className="text-label-md text-on-surface-variant">{items.length} Pos</span>
            </div>

            <ul className="flex flex-col gap-3">
              {items.map(({ category, usage, status }) => {
                const barColor =
                  status === "over" ? "bg-expense"
                    : status === "at_limit" ? "bg-orange-500"
                      : status === "near" ? "bg-amber-500"
                        : "bg-income";
                return (
                  <li key={category.id} className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
                    <Link
                      href={`/testing/budget/history/${category.id}`}
                      aria-label={`Lihat riwayat transaksi ${category.name}`}
                      className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
                        <Icon name="category" size={20} className="text-on-surface-variant" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="break-words text-body-md font-medium text-on-surface">
                          {category.name}
                        </span>
                        <span className="text-label-xs text-on-surface-variant">
                          Lihat riwayat transaksi
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <AmountText value={usage.spent} size="none" className="text-currency-body text-on-surface" />
                        <span className="text-label-xs text-on-surface-variant">Terpakai</span>
                      </span>
                      <Icon name="arrow_forward" size={18} className="shrink-0 text-on-surface-variant" />
                    </Link>
                    <div className="flex items-center justify-between gap-3 text-label-md text-on-surface-variant">
                      <span>Batas <AmountText value={usage.planned} size="none" className="text-label-md" /></span>
                      <span>Sisa <AmountText value={usage.remaining} size="none" className="text-label-md" tone={usage.isOverBudget ? "expense" : "default"} /></span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low"
                      role="progressbar"
                      aria-label={`${category.name} ${Math.round(usage.barPercent)} persen terpakai`}
                      aria-valuenow={Math.round(usage.barPercent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${usage.barPercent}%` }} />
                    </div>
                    <p className="flex items-center justify-between gap-3 text-body-sm text-on-surface-variant">
                      <span>{Math.round(usage.ratio * 100)}% terpakai</span>
                      <span className={status === "over" ? "font-semibold text-expense" : status === "at_limit" ? "font-semibold text-orange-700 dark:text-orange-400" : status === "near" ? "font-semibold text-amber-700 dark:text-amber-400" : "font-semibold text-income"}>
                        {statusLabels[status]}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <Link
            href="/testing/budget/edit"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 font-semibold text-on-surface"
          >
            <Icon name="edit" size={18} /> Coba format Edit Anggaran (Demo)
          </Link>
        </div>
      </PageContainer>
    </main>
  );
}
