import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  activeMonthFrom,
  buildTransactionListQuery,
  computeMonthIncomeExpense,
  fetchActiveAccounts,
  fetchUsableCategories,
  groupTransactionsByDay,
  parseTransactionFilters,
  type CategoryRow,
  type TransactionRow,
} from "@/lib/transactions";
import { formatMonthLabel } from "@/lib/budgets";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionFilters } from "@/components/finance/transaction-filters";
import { TransactionDayGroups } from "@/components/transactions/transaction-day-groups";
import { LedgerSummaryPill } from "@/components/transactions/ledger-summary-pill";
import type { TransactionRowView } from "@/components/transactions/transaction-ledger-row";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TransactionsLoading } from "@/app/(app)/transactions/loading";

type SearchParams = Record<string, string | string[] | undefined>;

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <AppHeader
        title="Transaksi"
        action={
          <Button asChild size="sm" className="h-9">
            <Link href="/transactions/new">
              <Icon name="add" size={18} />
              Tambah transaksi
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <Suspense fallback={<TransactionsLoading />}>
          <TransactionsContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the query strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <TransactionsError message="Sesi berakhir. Silakan masuk kembali untuk melihat transaksi." />
    );
  }

  const filters = parseTransactionFilters(resolvedSearchParams);
  const hasActiveFilter = Object.keys(filters).length > 0;

  // Accounts and categories populate the filter selects and resolve the id to
  // display name mappings below.
  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    fetchActiveAccounts(supabase, user.id),
    fetchUsableCategories(supabase, user.id, "income"),
    fetchUsableCategories(supabase, user.id, "expense"),
  ]);

  const { data, error } = await buildTransactionListQuery(
    supabase,
    user.id,
    filters,
  );

  if (error) {
    return (
      <TransactionsError message="Transaksi gagal dimuat. Periksa koneksi lalu coba lagi." />
    );
  }

  const transactions = (data ?? []) as TransactionRow[];

  // No transactions at all: a first-run empty state inviting the first entry.
  if (transactions.length === 0 && !hasActiveFilter) {
    return (
      <LedgerEmptyState
        glyph="receipt_long"
        title="Belum ada transaksi"
        description="Catat pemasukan atau pengeluaran pertamamu untuk mulai melihat riwayat di sini."
        action={
          <Button asChild className="h-11">
            <Link href="/transactions/new">
              <Icon name="add" size={18} />
              Tambah transaksi
            </Link>
          </Button>
        }
      />
    );
  }

  // Build id to name maps. Account names come from the active-accounts fetch;
  // archived accounts a transaction may still reference are resolved by a
  // small follow-up lookup so the row never shows a blank account.
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const missingAccountIds = new Set<string>();
  for (const t of transactions) {
    if (t.account_id && !accountNameById.has(t.account_id)) {
      missingAccountIds.add(t.account_id);
    }
    if (
      t.destination_account_id &&
      !accountNameById.has(t.destination_account_id)
    ) {
      missingAccountIds.add(t.destination_account_id);
    }
  }
  if (missingAccountIds.size > 0) {
    const { data: extraAccounts } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", user.id)
      .in("id", Array.from(missingAccountIds));
    for (const a of extraAccounts ?? []) {
      accountNameById.set(a.id, a.name);
    }
  }

  // Category names: start from the usable income/expense lists, then fill any
  // referenced category not already present (e.g. an archived category).
  const categoryNameById = new Map<string, string>();
  for (const c of [...incomeCategories, ...expenseCategories]) {
    categoryNameById.set(c.id, c.name);
  }
  const missingCategoryIds = new Set<string>();
  for (const t of transactions) {
    if (t.category_id && !categoryNameById.has(t.category_id)) {
      missingCategoryIds.add(t.category_id);
    }
  }
  if (missingCategoryIds.size > 0) {
    const { data: extraCategories } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", Array.from(missingCategoryIds));
    for (const c of (extraCategories ?? []) as Pick<
      CategoryRow,
      "id" | "name"
    >[]) {
      categoryNameById.set(c.id, c.name);
    }
  }

  const rows: TransactionRowView[] = transactions.map((t) => ({
    ...t,
    accountName: t.account_id ? accountNameById.get(t.account_id) ?? null : null,
    destinationAccountName: t.destination_account_id
      ? accountNameById.get(t.destination_account_id) ?? null
      : null,
    categoryName: t.category_id
      ? categoryNameById.get(t.category_id) ?? null
      : null,
  }));

  // Categories offered in the filter are the union of usable income + expense,
  // deduplicated, so the select lists each category once.
  const filterCategories = Array.from(
    new Map(
      [...incomeCategories, ...expenseCategories].map((c) => [c.id, c]),
    ).values(),
  );

  // Month summary pill: the active month is the explicit `month` filter or the
  // current month. It reuses the same income/expense math as the dashboard and
  // budget, so the totals line up (transfers excluded). A failed compute
  // degrades to a quiet notice instead of crashing the page.
  const activeMonth = activeMonthFrom(filters);
  let monthIncome = 0;
  let monthExpense = 0;
  let monthIncomplete = false;
  try {
    const summary = await computeMonthIncomeExpense(
      supabase,
      user.id,
      activeMonth,
    );
    monthIncome = summary.income;
    monthExpense = summary.expense;
  } catch {
    monthIncomplete = true;
  }

  // Group the already-ordered rows into per-day sections (newest day first),
  // with real per-day net totals computed server-side from the same rows.
  const groups = groupTransactionsByDay(rows);

  return (
    <div className="flex flex-col gap-6">
      <TransactionFilters accounts={accounts} categories={filterCategories} />

      <LedgerSummaryPill
        income={monthIncome}
        expense={monthExpense}
        monthLabel={formatMonthLabel(activeMonth)}
        incomplete={monthIncomplete}
      />

      {rows.length === 0 ? (
        // Filtered-empty: distinct from the first-run empty state. Names the
        // cause and offers a reset back to the unfiltered list.
        <LedgerEmptyState
          glyph="search_off"
          title="Tidak ada transaksi ditemukan"
          description="Tidak ada transaksi yang cocok dengan filter atau pencarian saat ini."
          action={
            <Button asChild variant="outline" className="h-11">
              <Link href="/transactions">Atur ulang filter</Link>
            </Button>
          }
        />
      ) : (
        <TransactionDayGroups groups={groups} />
      )}
    </div>
  );
}

// Stitch empty state (Material Symbols, Calm Ledger tokens). Kept local to this
// screen so the shared lucide-based EmptyState API stays untouched for other
// callers.
function LedgerEmptyState({
  glyph,
  title,
  description,
  action,
}: {
  glyph: string;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={glyph} size={24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-title-md font-medium text-on-surface">{title}</p>
        <p className="max-w-xs text-body-sm text-on-surface-variant">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function TransactionsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/transactions">Muat ulang</Link>
      </Button>
    </div>
  );
}
