import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  computeAccountBalances,
  getAccountTypeMeta,
  sumRunningAccountBalances,
  type AccountRow,
} from "@/lib/accounts";
import {
  computeBudgetTotals,
  computeCategorySpending,
  computeItemUsage,
  currentMonthParam,
  fetchBudgetForMonth,
  fetchBudgetItems,
  formatMonthLabel,
  toMonthStorage,
  type BudgetItemView,
  type CategoryRow as BudgetCategoryRow,
} from "@/lib/budgets";
import {
  buildTransactionListQuery,
  computeMonthIncomeExpense,
  type CategoryRow,
  type TransactionRow,
} from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { NetBalanceCard } from "@/components/dashboard/net-balance-card";
import { BudgetOverviewCard } from "@/components/dashboard/budget-overview-card";
import {
  DashboardAccountCard,
  accountTypeGlyph,
} from "@/components/dashboard/dashboard-account-card";
import { RecentTransactionRow } from "@/components/dashboard/recent-transaction-row";
import { DashboardLoading } from "@/app/(app)/dashboard/loading";

// How many account cards the dashboard shows before linking to the full list.
// The dashboard is a glance view, not the accounts manager, so a few cards keep
// it uncluttered; the rest live on /accounts via the "Lihat Semua" link.
const ACCOUNT_CARD_LIMIT = 6;

export default function DashboardPage() {
  // Keep the Beranda header free of duplicate actions; Laporan lives in
  // Pengaturan.
  return (
    <>
      <AppHeader title="Beranda" />
      <PageContainer>
        <Suspense fallback={<DashboardLoading />}>
          <DashboardContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // every query strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <DashboardError message="Sesi berakhir. Silakan masuk kembali untuk melihat beranda." />
    );
  }

  // One accounts query feeds both views: the grand total (all accounts) and the
  // card row (non-archived only). No N+1.
  const { data: accountsData, error: accountsError } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (accountsError) {
    return (
      <DashboardError message="Beranda gagal dimuat. Periksa koneksi lalu coba lagi." />
    );
  }

  const allAccounts = (accountsData ?? []) as AccountRow[];
  const activeAccounts = allAccounts.filter((a) => !a.is_archived);

  // Running balance = initial_balance + net of this user's transactions. If the
  // transactions fetch fails we degrade to initial_balance (never crash) and
  // flag it so the UI can note the figures may be incomplete.
  const balances = new Map<string, number>();
  let balancesIncomplete = false;
  try {
    const net = await computeAccountBalances(supabase, user.id);
    for (const account of allAccounts) {
      balances.set(
        account.id,
        account.initial_balance + (net.get(account.id) ?? 0),
      );
    }
  } catch {
    balancesIncomplete = true;
    for (const account of allAccounts) {
      balances.set(account.id, account.initial_balance);
    }
  }

  const grandTotal = sumRunningAccountBalances(allAccounts, balances);

  // This-month income/expense over the [first of month, first of next month)
  // UTC window; transfers excluded from both. Degrade quietly on failure.
  const month = currentMonthParam();
  let income = 0;
  let expense = 0;
  let monthIncomplete = false;
  try {
    const summary = await computeMonthIncomeExpense(supabase, user.id, month);
    income = summary.income;
    expense = summary.expense;
  } catch {
    monthIncomplete = true;
  }

  // Current-month budget summary. Replicates the budget page compose pattern
  // (no new shared helper) and is guarded in its own block so a budget failure
  // degrades to an incomplete notice rather than crashing the dashboard.
  let hasBudget = false;
  let budgetPlanned = 0;
  let budgetSpent = 0;
  let budgetRemaining = 0;
  let budgetBarPercent = 0;
  let budgetIncomplete = false;
  try {
    const budget = await fetchBudgetForMonth(
      supabase,
      user.id,
      toMonthStorage(month),
    );
    if (budget) {
      hasBudget = true;
      const items = await fetchBudgetItems(supabase, user.id, budget.id);

      // De-duplicate defensively by category_id (first item per category wins).
      const seenCategories = new Set<string>();
      const uniqueItems = items.filter((item) => {
        if (seenCategories.has(item.category_id)) return false;
        seenCategories.add(item.category_id);
        return true;
      });

      const categoryNameById = new Map<string, string>();
      const categoryIds = uniqueItems.map((item) => item.category_id);
      if (categoryIds.length > 0) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id, name")
          .in("id", categoryIds);
        for (const c of (cats ?? []) as Pick<
          BudgetCategoryRow,
          "id" | "name"
        >[]) {
          categoryNameById.set(c.id, c.name);
        }
      }

      let spending = new Map<string, number>();
      try {
        spending = await computeCategorySpending(
          supabase,
          user.id,
          month,
          categoryIds,
        );
      } catch {
        budgetIncomplete = true;
      }

      const views: BudgetItemView[] = uniqueItems.map((item) => {
        const planned = Number(item.planned_amount);
        const spent = spending.get(item.category_id) ?? 0;
        return {
          ...item,
          categoryName: categoryNameById.get(item.category_id) ?? null,
          usage: computeItemUsage(planned, spent),
        };
      });

      const totals = computeBudgetTotals(views);
      budgetPlanned = totals.planned;
      budgetSpent = totals.spent;
      budgetRemaining = totals.remaining;
      // Same clamp as computeItemUsage.barPercent, applied to the totals:
      // computeItemUsage(planned, spent) yields barPercent = clamp(spent/planned).
      budgetBarPercent = computeItemUsage(
        totals.planned,
        totals.spent,
      ).barPercent;
    }
  } catch {
    budgetIncomplete = true;
  }
  const monthLabel = formatMonthLabel(month);

  // Recent transactions: reuse the ledger's exact newest-first ordering, then
  // keep the top few. A failed fetch degrades to an empty list + a quiet flag.
  const { data: recentData, error: recentError } =
    await buildTransactionListQuery(supabase, user.id, {});
  const recentIncomplete = Boolean(recentError);
  const recentRows = ((recentData ?? []) as TransactionRow[]).slice(0, 4);

  // Resolve account/category display names only for the shown rows: two scoped
  // in(...) lookups at most, never per-row (no N+1).
  const accountNameById = new Map<string, string>();
  const categoryNameById = new Map<string, string>();
  if (recentRows.length > 0) {
    const accountIds = new Set<string>();
    const categoryIds = new Set<string>();
    for (const t of recentRows) {
      if (t.account_id) accountIds.add(t.account_id);
      if (t.destination_account_id) accountIds.add(t.destination_account_id);
      if (t.category_id) categoryIds.add(t.category_id);
    }

    if (accountIds.size > 0) {
      const { data: accountNames } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("user_id", user.id)
        .in("id", Array.from(accountIds));
      for (const a of accountNames ?? []) accountNameById.set(a.id, a.name);
    }

    if (categoryIds.size > 0) {
      // Scope to the user's own categories OR system categories (user_id null),
      // mirroring the scoping used elsewhere. The ids already come from the
      // user's own transactions, but this keeps the lookup consistent and
      // defense-in-depth rather than relying only on that.
      const { data: categoryNames } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", Array.from(categoryIds))
        .or(`user_id.eq.${user.id},user_id.is.null`);
      for (const c of (categoryNames ?? []) as Pick<
        CategoryRow,
        "id" | "name"
      >[]) {
        categoryNameById.set(c.id, c.name);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <NetBalanceCard
        balance={grandTotal}
        incomplete={balancesIncomplete}
        income={income}
        expense={expense}
        monthIncomplete={monthIncomplete}
      />

      <BudgetOverviewCard
        monthLabel={monthLabel}
        hasBudget={hasBudget}
        planned={budgetPlanned}
        spent={budgetSpent}
        remaining={budgetRemaining}
        barPercent={budgetBarPercent}
        incomplete={budgetIncomplete}
        createHref={`/budget/new?month=${month}`}
      />

      <section className="flex flex-col gap-3">
        <SectionHeaderRow
          title="Rekening & Dompet"
          linkLabel={activeAccounts.length > 0 ? "Lihat Semua" : null}
          href="/accounts"
        />
        {activeAccounts.length === 0 ? (
          <EmptyPanel
            glyph="account_balance_wallet"
            title="Belum ada rekening"
            description="Tambahkan rekening pertamamu untuk mulai mencatat saldo."
            actionLabel="Tambah rekening"
            actionHref="/accounts/new"
          />
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {activeAccounts.slice(0, ACCOUNT_CARD_LIMIT).map((account) => {
              const meta = getAccountTypeMeta(account.account_type);
              return (
                <DashboardAccountCard
                  key={account.id}
                  name={account.name}
                  typeLabel={meta.label}
                  glyph={accountTypeGlyph(account.account_type)}
                  balance={
                    balances.get(account.id) ?? account.initial_balance
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeaderRow
          title="Transaksi Terbaru"
          secondaryLinkLabel={recentRows.length > 0 ? "Semua Transaksi" : null}
          secondaryHref="/transactions"
        />
        {recentIncomplete ? (
          <p role="alert" className="text-body-sm text-on-surface-variant">
            Transaksi terakhir belum bisa dimuat. Coba muat ulang.
          </p>
        ) : recentRows.length === 0 ? (
          <EmptyPanel
            glyph="receipt_long"
            title="Belum ada transaksi"
            description="Catat pemasukan atau pengeluaran pertamamu untuk melihatnya di sini."
            actionLabel="Tambah transaksi"
            actionHref="/transactions/new"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-surface-container rounded-xl border border-outline-variant bg-surface-container-lowest">
            {recentRows.map((transaction) => (
              <RecentTransactionRow
                key={transaction.id}
                transaction={transaction}
                accountName={
                  transaction.account_id
                    ? accountNameById.get(transaction.account_id) ?? null
                    : null
                }
                destinationAccountName={
                  transaction.destination_account_id
                    ? accountNameById.get(
                        transaction.destination_account_id,
                      ) ?? null
                    : null
                }
                categoryName={
                  transaction.category_id
                    ? categoryNameById.get(transaction.category_id) ?? null
                    : null
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Section header row with optional navigation links, styled with the current
// semantic tokens and type scale.
function SectionHeaderRow({
  title,
  linkLabel,
  href,
  secondaryLinkLabel,
  secondaryHref,
}: {
  title: string;
  linkLabel?: string | null;
  href?: string;
  secondaryLinkLabel?: string | null;
  secondaryHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 max-[240px]:flex-col max-[240px]:items-start">
      <h2 className="text-title-md text-on-surface">{title}</h2>
      <div className="ml-auto flex items-center gap-2 max-[240px]:ml-0 max-[240px]:w-full max-[240px]:flex-wrap">
        {linkLabel && href ? (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center rounded-md px-1 text-label-md text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {linkLabel}
          </Link>
        ) : null}
        {secondaryLinkLabel && secondaryHref ? (
          <Link
            href={secondaryHref}
            className="inline-flex min-h-11 items-center rounded-md px-1 text-label-md text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {secondaryLinkLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// Honest empty state with a Material Symbol glyph and a primary action link.
function EmptyPanel({
  glyph,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  glyph: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-container-lowest p-6 text-center shadow-sm">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={glyph} size={26} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-title-md text-on-surface">{title}</p>
        <p className="text-body-sm text-on-surface-variant">{description}</p>
      </div>
      <Link
        href={actionHref}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-label-md text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <Icon name="add" size={18} />
        {actionLabel}
      </Link>
    </div>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/dashboard">Muat ulang</Link>
      </Button>
    </div>
  );
}
