import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

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
      <AppHeader
        title="Beranda"
        className="lg:max-w-4xl xl:max-w-6xl"
      />
      <PageContainer className="lg:max-w-4xl xl:max-w-6xl">
        <Suspense fallback={<DashboardLoading />}>
          <DashboardContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

type DashboardSupabase = Awaited<ReturnType<typeof createClient>>;

type Settled<T> = { ok: true; value: T } | { ok: false };

// Runs a promise and turns a thrown error into { ok: false }, so one failing
// section degrades on its own instead of taking the whole dashboard down.
async function settle<T>(promise: PromiseLike<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch {
    return { ok: false };
  }
}

interface BudgetSummary {
  hasBudget: boolean;
  planned: number;
  spent: number;
  remaining: number;
  barPercent: number;
  incomplete: boolean;
}

// Current-month budget summary. Guarded so a budget failure degrades to an
// incomplete notice rather than crashing the dashboard.
async function loadBudgetSummary(
  supabase: DashboardSupabase,
  userId: string,
  month: string,
): Promise<BudgetSummary> {
  const empty: BudgetSummary = {
    hasBudget: false,
    planned: 0,
    spent: 0,
    remaining: 0,
    barPercent: 0,
    incomplete: false,
  };

  try {
    const budget = await fetchBudgetForMonth(
      supabase,
      userId,
      toMonthStorage(month),
    );
    if (!budget) return empty;

    const items = await fetchBudgetItems(supabase, userId, budget.id);

    // De-duplicate defensively by category_id (first item per category wins).
    const seenCategories = new Set<string>();
    const uniqueItems = items.filter((item) => {
      if (seenCategories.has(item.category_id)) return false;
      seenCategories.add(item.category_id);
      return true;
    });
    const categoryIds = uniqueItems.map((item) => item.category_id);

    const loadCategoryNames = async () => {
      const names = new Map<string, string>();
      if (categoryIds.length === 0) return names;
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", categoryIds);
      for (const c of (cats ?? []) as Pick<
        BudgetCategoryRow,
        "id" | "name"
      >[]) {
        names.set(c.id, c.name);
      }
      return names;
    };

    // Category names and spending only need the category ids, so they are
    // fetched together instead of one after the other.
    const [categoryNameById, spendingResult] = await Promise.all([
      loadCategoryNames(),
      settle(computeCategorySpending(supabase, userId, month, categoryIds)),
    ]);
    const spending = spendingResult.ok
      ? spendingResult.value
      : new Map<string, number>();

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
    return {
      hasBudget: true,
      planned: totals.planned,
      spent: totals.spent,
      remaining: totals.remaining,
      // Same clamp as computeItemUsage.barPercent, applied to the totals.
      barPercent: computeItemUsage(totals.planned, totals.spent).barPercent,
      incomplete: !spendingResult.ok,
    };
  } catch {
    return { ...empty, incomplete: true };
  }
}

async function DashboardContent() {
  // Reading the clock (token expiry check) before this point is flagged by
  // cacheComponents; connection() marks the rest as request-time work.
  await connection();

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

  const month = currentMonthParam();

  // These five reads do not depend on each other, so they run in parallel
  // (one round trip of waiting instead of five in a row).
  // - accounts: feeds both the grand total (all) and the card row (active).
  // - balances: initial_balance + net of this user's transactions.
  // - month: this-month income/expense; transfers excluded from both.
  // - budget: current-month budget summary.
  // - recent: the ledger's newest-first ordering, limited to the 4 rows the
  //   dashboard shows (it used to download every transaction).
  const [accountsResult, balancesResult, monthResult, budget, recentResult] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      settle(computeAccountBalances(supabase, user.id)),
      settle(computeMonthIncomeExpense(supabase, user.id, month)),
      loadBudgetSummary(supabase, user.id, month),
      buildTransactionListQuery(supabase, user.id, {}).limit(4),
    ]);

  const { data: accountsData, error: accountsError } = accountsResult;
  if (accountsError) {
    return (
      <DashboardError message="Beranda gagal dimuat. Periksa koneksi lalu coba lagi." />
    );
  }

  const allAccounts = (accountsData ?? []) as AccountRow[];
  const activeAccounts = allAccounts.filter((a) => !a.is_archived);

  // If the transactions fetch failed we degrade to initial_balance (never
  // crash) and flag it so the UI can note the figures may be incomplete.
  const balances = new Map<string, number>();
  const balancesIncomplete = !balancesResult.ok;
  const net = balancesResult.ok ? balancesResult.value : null;
  for (const account of allAccounts) {
    balances.set(
      account.id,
      account.initial_balance + (net?.get(account.id) ?? 0),
    );
  }
  const grandTotal = sumRunningAccountBalances(allAccounts, balances);

  const monthIncomplete = !monthResult.ok;
  const income = monthResult.ok ? monthResult.value.income : 0;
  const expense = monthResult.ok ? monthResult.value.expense : 0;

  const hasBudget = budget.hasBudget;
  const budgetPlanned = budget.planned;
  const budgetSpent = budget.spent;
  const budgetRemaining = budget.remaining;
  const budgetBarPercent = budget.barPercent;
  const budgetIncomplete = budget.incomplete;
  const monthLabel = formatMonthLabel(month);

  // A failed fetch degrades to an empty list + a quiet flag.
  const recentIncomplete = Boolean(recentResult.error);
  const recentRows = (recentResult.data ?? []) as TransactionRow[];

  // Resolve account/category display names only for the shown rows: two scoped
  // in(...) lookups at most (run together), never per-row (no N+1).
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

    const [accountNamesResult, categoryNamesResult] = await Promise.all([
      accountIds.size > 0
        ? supabase
            .from("accounts")
            .select("id, name")
            .eq("user_id", user.id)
            .in("id", Array.from(accountIds))
        : null,
      // Scope to the user's own categories OR system categories (user_id
      // null), mirroring the scoping used elsewhere. The ids already come from
      // the user's own transactions; this is defense-in-depth.
      categoryIds.size > 0
        ? supabase
            .from("categories")
            .select("id, name")
            .in("id", Array.from(categoryIds))
            .or(`user_id.eq.${user.id},user_id.is.null`)
        : null,
    ]);

    for (const a of accountNamesResult?.data ?? []) {
      accountNameById.set(a.id, a.name);
    }
    for (const c of (categoryNamesResult?.data ?? []) as Pick<
      CategoryRow,
      "id" | "name"
    >[]) {
      categoryNameById.set(c.id, c.name);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
