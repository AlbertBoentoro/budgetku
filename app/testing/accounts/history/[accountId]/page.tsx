import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { isPublicTestingDemoAllowed } from "@/lib/auth/public-testing-demo";
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS, DEMO_EXPENSE_CATEGORIES, DEMO_INCOME_CATEGORIES } from "@/lib/testing/demo-budgetku-data";
import { groupTransactionsByDay } from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

type Props = { params: Promise<{ accountId: string }> };

/** Synthetic no-login demo; real account history stays in the authenticated ledger. */
export default function TestingAccountHistoryPage({ params }: Props) {
  if (!isPublicTestingDemoAllowed()) notFound();

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader
        title="Riwayat Rekening (Demo)"
        titleAction={<AppBackLink href="/testing/accounts" label="Kembali ke rekening" />}
      />
      <PageContainer>
        <Suspense fallback={<p className="py-10 text-body-sm text-on-surface-variant">Memuat riwayat contoh...</p>}>
          <HistoryContent params={params} />
        </Suspense>
      </PageContainer>
    </main>
  );
}

async function HistoryContent({ params }: Props) {
  // The date-grouping utility reads the clock. Avoid Next.js prerendering errors.
  await connection();
  const { accountId } = await params;
  const account = DEMO_ACCOUNTS[0];
  if (accountId !== account.id) notFound();

  // Account history includes both inflows and outflows, unlike a budget's
  // expense-only history. Matches source OR destination of transfers.
  const transactions = DEMO_TRANSACTIONS.filter(
    (tx) => tx.account_id === accountId || tx.destination_account_id === accountId,
  ).sort((a, b) => b.transaction_at.localeCompare(a.transaction_at));

  const categories = [...DEMO_EXPENSE_CATEGORIES, ...DEMO_INCOME_CATEGORIES];
  const groups = groupTransactionsByDay(transactions);

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface">
        <strong>Data dummy · tanpa login.</strong> Riwayat ini hanya contoh.
        Di aplikasi asli, klik rekening akan langsung membuka transaksi rekening itu,
        dengan filter rekening yang sudah terpasang.
      </p>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <h2 className="text-title-md font-semibold text-on-surface">{account.name}</h2>
        <p className="text-body-sm text-on-surface-variant">
          {transactions.length} transaksi contoh · Pemasukan dan pengeluaran
        </p>
      </section>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-on-surface-variant">
          Belum ada transaksi pada rekening ini.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-label-md text-on-surface-variant">{group.label}</h3>
                <AmountText value={group.netTotal} size="none" signed className="text-label-md font-semibold" />
              </div>
              <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
                {group.rows.map((transaction) => {
                  const expense = transaction.transaction_type === "expense";
                  const category = categories.find((cat) => cat.id === transaction.category_id);
                  return (
                    <li key={transaction.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
                        <Icon name={expense ? "arrow_upward" : "arrow_downward"} size={20} className={expense ? "text-expense" : "text-income"} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-body-md font-medium text-on-surface">
                          {transaction.merchant ?? transaction.description ?? "Transaksi"}
                        </span>
                        <span className="truncate text-body-sm text-on-surface-variant">
                          {category?.name ?? "Tanpa kategori"} · {transaction.description ?? ""}
                        </span>
                      </span>
                      <AmountText
                        value={expense ? -transaction.amount : transaction.amount}
                        size="none"
                        signed
                        tone={expense ? "expense" : "income"}
                        className="text-body-md font-semibold"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
