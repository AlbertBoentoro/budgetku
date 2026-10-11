import { Suspense } from "react";
import Link from "next/link";
import { Plus, Receipt, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  computeAccountBalances,
  getAccountTypeMeta,
  type AccountRow,
} from "@/lib/accounts";
import { currentMonthParam } from "@/lib/budgets";
import {
  buildTransactionListQuery,
  computeMonthIncomeExpense,
  getTransactionTypeMeta,
  type CategoryRow,
  type TransactionRow,
} from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AccountCard } from "@/components/finance/account-card";
import { AmountText } from "@/components/finance/amount-text";
import { BalanceCard } from "@/components/finance/balance-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { DashboardLoading } from "@/app/(app)/dashboard/loading";

// How many account cards the dashboard shows before linking to the full list.
// The dashboard is a glance view, not the accounts manager, so a few cards keep
// it uncluttered; the rest live on /accounts via the "Lihat semua" link.
const ACCOUNT_CARD_LIMIT = 4;

// Date-only formatter (e.g. "4 Mar 2025"), matching the ledger row so recent
// transactions read the same on the dashboard as on the transactions page.
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

export default function DashboardPage() {
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

  // One accounts query feeds both views: the grand total (all accounts honoring
  // include_in_total) and the card grid (non-archived only). No N+1.
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

  // Grand total (focal): sum running balances over accounts flagged
  // include_in_total, regardless of archived state (an archived account can
  // still count toward net worth). Each term is guarded against a non-finite
  // value so one bad row cannot poison the total.
  let grandTotal = 0;
  for (const account of allAccounts) {
    if (!account.include_in_total) continue;
    const balance = balances.get(account.id) ?? account.initial_balance;
    if (Number.isFinite(balance)) grandTotal += balance;
  }

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
  const net = income - expense;

  // Recent transactions: reuse the ledger's exact newest-first ordering, then
  // keep the top few. A failed fetch degrades to an empty list + a quiet flag.
  const { data: recentData, error: recentError } =
    await buildTransactionListQuery(supabase, user.id, {});
  const recentIncomplete = Boolean(recentError);
  const recentRows = ((recentData ?? []) as TransactionRow[]).slice(0, 5);

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
    <>
      <div className="flex flex-col gap-2">
        <BalanceCard balance={grandTotal} />
        {balancesIncomplete ? (
          <p role="alert" className="text-sm text-muted-foreground">
            Saldo mungkin belum lengkap. Coba muat ulang.
          </p>
        ) : null}
      </div>

      {/* This-month summary. Meaning is carried by label + sign + tone together,
          never color alone: income reads "+Rp", expense reads "-Rp" (value
          negated to match the ledger convention). */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Bulan ini" />
        {monthIncomplete ? (
          <p role="alert" className="text-sm text-muted-foreground">
            Ringkasan bulan ini belum bisa dimuat. Coba muat ulang.
          </p>
        ) : (
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-soft">
              <span className="text-sm text-muted-foreground">
                Pemasukan bulan ini
              </span>
              <AmountText value={income} tone="income" size="lg" signed />
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-soft">
              <span className="text-sm text-muted-foreground">
                Pengeluaran bulan ini
              </span>
              <AmountText value={-expense} tone="expense" size="lg" signed />
            </div>
            <div className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-soft min-[375px]:col-span-2">
              <span className="text-sm text-muted-foreground">Selisih</span>
              <AmountText
                value={net}
                tone={net > 0 ? "income" : net < 0 ? "expense" : "default"}
                size="md"
                signed
              />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Rekening"
          action={
            activeAccounts.length > ACCOUNT_CARD_LIMIT ? (
              <Button asChild variant="ghost" size="sm" className="h-8">
                <Link href="/accounts">Lihat semua</Link>
              </Button>
            ) : null
          }
        />
        {activeAccounts.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <EmptyState
              icon={Wallet}
              title="Belum ada rekening"
              description="Tambahkan rekening pertamamu untuk mulai mencatat saldo."
            />
            <Button asChild className="h-11">
              <Link href="/accounts/new">
                <Plus aria-hidden />
                Tambah rekening
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
            {activeAccounts.slice(0, ACCOUNT_CARD_LIMIT).map((account) => {
              const meta = getAccountTypeMeta(account.account_type);
              return (
                <AccountCard
                  key={account.id}
                  name={account.name}
                  balance={balances.get(account.id) ?? account.initial_balance}
                  accent={meta.accent}
                  icon={meta.icon}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Transaksi terakhir"
          action={
            recentRows.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="h-8">
                <Link href="/transactions">Lihat semua</Link>
              </Button>
            ) : null
          }
        />
        {recentIncomplete ? (
          <p role="alert" className="text-sm text-muted-foreground">
            Transaksi terakhir belum bisa dimuat. Coba muat ulang.
          </p>
        ) : recentRows.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <EmptyState
              icon={Receipt}
              title="Belum ada transaksi"
              description="Catat pemasukan atau pengeluaran pertamamu untuk melihatnya di sini."
            />
            <Button asChild className="h-11">
              <Link href="/transactions/new">
                <Plus aria-hidden />
                Tambah transaksi
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y rounded-2xl border bg-card">
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
    </>
  );
}

interface RecentTransactionRowProps {
  transaction: TransactionRow;
  accountName: string | null;
  destinationAccountName: string | null;
  categoryName: string | null;
}

// Read-only recent-transaction row. It reuses AmountText, getTransactionTypeMeta,
// and the same sign/tone/label conventions as the ledger row, but carries no
// edit/delete actions (the dashboard is a glance view; actions live on
// /transactions). It never fabricates a label: merchant, then description, then
// category, then the type label.
function RecentTransactionRow({
  transaction,
  accountName,
  destinationAccountName,
  categoryName,
}: RecentTransactionRowProps) {
  const meta = getTransactionTypeMeta(transaction.transaction_type);
  const Icon = meta.icon;
  const isTransfer = transaction.transaction_type === "transfer";
  const isExpense = transaction.transaction_type === "expense";
  const isIncome = transaction.transaction_type === "income";

  const primaryLabel =
    transaction.merchant ||
    transaction.description ||
    categoryName ||
    meta.label;

  // Expense negated so it reads "-Rp"; income positive so it reads "+Rp"; a
  // transfer stays neutral with no sign. The stored amount is never scaled.
  const amountValue = isExpense ? -transaction.amount : transaction.amount;
  const amountTone = isIncome ? "income" : isExpense ? "expense" : "default";

  const metaParts = [
    categoryName,
    accountName,
    formatDate(transaction.transaction_at),
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{primaryLabel}</span>
        {isTransfer ? (
          <span className="truncate text-sm text-muted-foreground">
            {(accountName ?? "Rekening") +
              " \u2192 " +
              (destinationAccountName ?? "Rekening") +
              " \u00b7 " +
              formatDate(transaction.transaction_at)}
          </span>
        ) : (
          <span className="truncate text-sm text-muted-foreground">
            {metaParts.join(" \u00b7 ")}
          </span>
        )}
      </div>
      <AmountText
        value={amountValue}
        tone={amountTone}
        size="sm"
        signed={!isTransfer}
      />
    </li>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/dashboard">Muat ulang</Link>
      </Button>
    </div>
  );
}
