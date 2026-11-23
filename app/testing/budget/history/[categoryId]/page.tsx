import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { isPublicTestingDemoAllowed } from "@/lib/auth/public-testing-demo";
import {
  DEMO_BUDGET_LIMITS,
  DEMO_BUDGET_TRANSACTIONS,
  DEMO_EXPENSE_CATEGORIES,
  DEMO_ACCOUNTS,
} from "@/lib/testing/demo-budgetku-data";
import { formatMonthLabel } from "@/lib/budgets";
import { groupTransactionsByDay } from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

const DEMO_MONTH = "2026-11";

/** Read-only synthetic category ledger; intentionally not the authenticated transactions route. */
type Props = { params: Promise<{ categoryId: string }> };

export default function TestingBudgetHistoryPage({ params }: Props) {
  if (!isPublicTestingDemoAllowed()) notFound();

  return (
    <Suspense fallback={<main className="px-4 py-10 text-body-sm text-on-surface-variant">Memuat riwayat transaksi demo...</main>}>
      <HistoryContent params={params} />
    </Suspense>
  );
}

async function HistoryContent({ params }: Props) {
  // groupTransactionsByDay reads the current date; render it after a request-time boundary.
  await connection();
  const { categoryId } = await params;
  const category = DEMO_EXPENSE_CATEGORIES.find((row) => row.id === categoryId);
  if (!category || !DEMO_BUDGET_LIMITS.some((item) => item.categoryName === category.name)) {
    notFound();
  }

  const transactions = DEMO_BUDGET_TRANSACTIONS.filter(
    (row) =>
      row.transaction_type === "expense" &&
      row.category_id === category.id &&
      row.transaction_at.startsWith(DEMO_MONTH),
  ).sort((a, b) => b.transaction_at.localeCompare(a.transaction_at));

  const spent = transactions.reduce((total, transaction) => total + transaction.amount, 0);
  const groups = groupTransactionsByDay(transactions);

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader
        title="Riwayat transaksi (Demo)"
        titleAction={<AppBackLink href="/testing/budget" label="Kembali ke anggaran" />}
      />
      <PageContainer>
        <div className="flex flex-col gap-6">
          <p className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm">
            <strong>Data dummy · tanpa login.</strong> Daftar ini hanya berisi
            pengeluaran kategori dan bulan terpilih. Tidak ada data yang disimpan.
          </p>

          <section className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
                <Icon name="category" size={20} className="text-on-surface-variant" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-title-md font-semibold text-on-surface">{category.name}</h2>
                <p className="text-body-sm text-on-surface-variant">
                  {formatMonthLabel(DEMO_MONTH)} · {transactions.length} transaksi pengeluaran
                </p>
              </div>
            </div>
            <div className="border-t border-outline-variant pt-3">
              <p className="text-label-xs uppercase text-on-surface-variant">Total terpakai</p>
              <AmountText value={spent} size="none" className="text-headline-lg text-on-surface" />
            </div>
          </section>

          {transactions.length === 0 ? (
            <section className="flex flex-col items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
              <Icon name="receipt_long" size={28} className="text-on-surface-variant" />
              <h2 className="font-semibold text-on-surface">Belum ada transaksi untuk kategori ini</h2>
              <p className="text-body-sm text-on-surface-variant">
                Anggaran tetap tercatat, tetapi belum ada pemakaian di {formatMonthLabel(DEMO_MONTH)}.
              </p>
            </section>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <h2 className="text-label-md font-medium text-on-surface-variant">{group.label}</h2>
                    <AmountText value={group.netTotal} size="none" tone="expense" className="text-label-md font-semibold" />
                  </div>
                  <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
                    {group.rows.map((transaction) => {
                      const accountName = DEMO_ACCOUNTS.find((account) => account.id === transaction.account_id)?.name ?? "Rekening";
                      return (
                        <li key={transaction.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-expense">
                            <Icon name="arrow_upward" size={20} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-body-md font-medium text-on-surface">
                              {transaction.merchant ?? transaction.description ?? "Pengeluaran"}
                            </span>
                            <span className="truncate text-body-sm text-on-surface-variant">
                              {transaction.description ? `${transaction.description} · ` : ""}{accountName}
                            </span>
                          </span>
                          <AmountText value={-transaction.amount} size="none" tone="expense" className="text-body-md font-semibold" />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <Link
            href="/testing/budget"
            className="flex min-h-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-body-sm font-semibold text-on-surface"
          >
            Kembali ke Anggaran Demo
          </Link>
        </div>
      </PageContainer>
    </main>
  );
}
