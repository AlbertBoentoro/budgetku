import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

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
  type TransactionFilters as TransactionFilterValues,
  type TransactionRow,
} from "@/lib/transactions";
import { accountTypeGlyph } from "@/components/dashboard/dashboard-account-card";
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
  // Reading the clock (token expiry check) before this point is flagged by
  // cacheComponents; connection() marks the rest as request-time work.
  await connection();

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

  const parsedFilters = parseTransactionFilters(resolvedSearchParams);
  const rawAccount = resolvedSearchParams.account;
  const accountRequested = Boolean(
    (Array.isArray(rawAccount) ? rawAccount[0] : rawAccount)?.trim(),
  );

  // Accounts and categories populate the filter selects and resolve the id to
  // display name mappings below. The account filter (already UUID-validated)
  // is looked up by id + user_id, archived included, so only the user's own
  // account can ever narrow the list.
  const [accounts, incomeCategories, expenseCategories, accountLookup] =
    await Promise.all([
      fetchActiveAccounts(supabase, user.id),
      fetchUsableCategories(supabase, user.id, "income"),
      fetchUsableCategories(supabase, user.id, "expense"),
      parsedFilters.account
        ? supabase
            .from("accounts")
            .select("id, name, account_type, is_archived")
            .eq("id", parsedFilters.account)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  // A failed lookup must not present an unfiltered list as this account's
  // history, so it uses the same error state as the list query.
  if (accountLookup.error) {
    return (
      <TransactionsError message="Transaksi gagal dimuat. Periksa koneksi lalu coba lagi." />
    );
  }

  const filterAccount: FilterAccount | null = accountLookup.data ?? null;
  const filters = filterAccount ? parsedFilters : withoutAccount(parsedFilters);
  const accountNotFound = accountRequested && !filterAccount;
  const hasActiveFilter = Object.keys(filters).length > 0;

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
      <div className="flex flex-col gap-6">
        {accountNotFound ? <AccountNotFoundNotice /> : null}
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
      </div>
    );
  }

  // Build id to name maps. Account names come from the active-accounts fetch
  // (plus the filtered account when it is archived); other archived accounts a
  // transaction may still reference are resolved by a small follow-up lookup
  // so the row never shows a blank account.
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  if (filterAccount && !accountNameById.has(filterAccount.id)) {
    accountNameById.set(filterAccount.id, filterAccount.name);
  }
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

  // Account-only filter: the empty state names the account history instead of
  // a generic "no match".
  const accountOnlyFilter =
    filterAccount !== null &&
    Object.keys(filters).length === 1 &&
    Boolean(filters.account);

  return (
    <div className="flex flex-col gap-6">
      {accountNotFound ? <AccountNotFoundNotice /> : null}

      {filterAccount ? (
        <AccountFilterBanner
          account={filterAccount}
          clearHref={transactionsHref(filters)}
        />
      ) : null}

      <TransactionFilters
        accounts={accounts}
        categories={filterCategories}
        extraAccount={
          filterAccount?.is_archived
            ? { id: filterAccount.id, name: filterAccount.name }
            : null
        }
      />

      <LedgerSummaryPill
        income={monthIncome}
        expense={monthExpense}
        monthLabel={formatMonthLabel(activeMonth)}
        incomplete={monthIncomplete}
      />

      {rows.length === 0 && accountOnlyFilter ? (
        <LedgerEmptyState
          glyph="receipt_long"
          title="Belum ada transaksi di rekening ini"
          description="Transaksi dari dan ke rekening ini akan muncul di sini."
          action={
            <Button asChild variant="outline" className="h-11">
              <Link href="/transactions">Lihat semua transaksi</Link>
            </Button>
          }
        />
      ) : rows.length === 0 ? (
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

type FilterAccount = {
  id: string;
  name: string;
  account_type: string;
  is_archived: boolean;
};

// Copy of the filters without `account` (used when the requested account is
// invalid, unknown, or not the user's).
function withoutAccount(
  filters: TransactionFilterValues,
): TransactionFilterValues {
  const rest = { ...filters };
  delete rest.account;
  return rest;
}

// /transactions URL that keeps the other active filters and drops `account`.
function transactionsHref(filters: TransactionFilterValues): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.category) params.set("category", filters.category);
  if (filters.month) params.set("month", filters.month);
  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

// Names the account the ledger is narrowed to and offers a real link out of
// that view. Server-rendered from the validated filter.
function AccountFilterBanner({
  account,
  clearHref,
}: {
  account: FilterAccount;
  clearHref: string;
}) {
  return (
    <section
      aria-labelledby="account-filter-heading"
      className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name={accountTypeGlyph(account.account_type)} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            id="account-filter-heading"
            className="text-label-md text-on-surface-variant"
          >
            Riwayat transaksi
          </h2>
          <p
            className="truncate text-body-md font-medium text-on-surface"
            title={account.name}
          >
            {account.name}
            {account.is_archived ? " \u00b7 Diarsipkan" : ""}
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 shrink-0">
          <Link
            href={clearHref}
            aria-label={`Hapus filter rekening ${account.name}`}
          >
            <Icon name="close" size={18} />
            Hapus filter
          </Link>
        </Button>
      </div>
      {/* Full-width caption so it never squeezes into the narrow name column
          at 320px. */}
      <p className="text-label-xs text-on-surface-variant">
        Ringkasan bulan tetap menghitung semua rekening.
      </p>
    </section>
  );
}

function AccountNotFoundNotice() {
  return (
    <p
      role="status"
      className="rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant"
    >
      Rekening pada tautan ini tidak ditemukan. Menampilkan semua transaksi.
    </p>
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
