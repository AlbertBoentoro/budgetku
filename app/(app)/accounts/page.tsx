import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  ACCOUNT_TYPES,
  computeAccountBalances,
  getAccountTypeMeta,
  type AccountRow,
} from "@/lib/accounts";
import { accountTypeGlyph } from "@/components/dashboard/dashboard-account-card";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AccountSummaryCard } from "@/components/accounts/account-summary-card";
import {
  AccountManager,
  type AccountSection,
} from "@/components/accounts/account-manager";
import type { AccountRowView } from "@/components/accounts/account-row";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AccountsLoading } from "@/app/(app)/accounts/loading";

export default function AccountsPage() {
  return (
    <>
      <AppHeader title="Rekening" />
      <PageContainer>
        <Suspense fallback={<AccountsLoading />}>
          <AccountsContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

// Maps an account row to the serializable per-row view model the client
// components render. The glyph comes from the Material Symbols map (this screen
// is lucide-free); the label/accent come from the shared account-type meta.
function toRowView(account: AccountRow, balance: number): AccountRowView {
  const meta = getAccountTypeMeta(account.account_type);
  return {
    id: account.id,
    name: account.name,
    typeLabel: meta.label,
    glyph: accountTypeGlyph(account.account_type),
    accent: meta.accent,
    balance,
    archived: account.is_archived,
  };
}

async function AccountsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the query strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <AccountsError message="Sesi berakhir. Silakan masuk kembali untuk melihat rekening." />
    );
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <AccountsError message="Rekening gagal dimuat. Periksa koneksi lalu coba lagi." />
    );
  }

  const accounts = (data ?? []) as AccountRow[];

  if (accounts.length === 0) {
    return <AccountsEmpty />;
  }

  // Running balance = initial_balance + net of this user's transactions. If the
  // transactions fetch fails we degrade to initial_balance (never crash the
  // list) and flag it so the UI can note the figures may be incomplete.
  const balances = new Map<string, number>();
  let balancesIncomplete = false;
  try {
    const net = await computeAccountBalances(supabase, user.id);
    for (const account of accounts) {
      balances.set(
        account.id,
        account.initial_balance + (net.get(account.id) ?? 0),
      );
    }
  } catch {
    balancesIncomplete = true;
    for (const account of accounts) {
      balances.set(account.id, account.initial_balance);
    }
  }

  const balanceOf = (account: AccountRow) =>
    balances.get(account.id) ?? account.initial_balance;

  // Summary total: sum of running balances over accounts flagged
  // include_in_total, regardless of archived state. Same rule as the dashboard
  // grand total. Guarded against a non-finite value so one bad row cannot
  // poison the total.
  let total = 0;
  for (const account of accounts) {
    if (!account.include_in_total) continue;
    const balance = balanceOf(account);
    if (Number.isFinite(balance)) total += balance;
  }

  // Active count: non-archived accounts. A distinct real number from the total.
  const activeCount = accounts.filter((a) => !a.is_archived).length;

  // Group non-archived accounts strictly by their real account_type. Curated
  // types render in ACCOUNT_TYPES order; any unknown/legacy type is appended
  // after the curated groups (fallback label + wallet glyph via meta/glyph).
  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const byType = new Map<string, AccountRow[]>();
  for (const account of activeAccounts) {
    const list = byType.get(account.account_type);
    if (list) {
      list.push(account);
    } else {
      byType.set(account.account_type, [account]);
    }
  }

  const orderedTypes = [
    ...ACCOUNT_TYPES.map((t) => t.value).filter((t) => byType.has(t)),
    ...[...byType.keys()].filter(
      (t) => !ACCOUNT_TYPES.some((a) => a.value === t),
    ),
  ];

  const sections: AccountSection[] = orderedTypes.map((type) => {
    const rows = byType.get(type) ?? [];
    const meta = getAccountTypeMeta(type);
    let subtotal = 0;
    for (const account of rows) {
      const balance = balanceOf(account);
      if (Number.isFinite(balance)) subtotal += balance;
    }
    return {
      type,
      label: meta.label,
      glyph: accountTypeGlyph(type),
      accent: meta.accent,
      subtotal,
      rows: rows.map((account) => toRowView(account, balanceOf(account))),
    };
  });

  const archived = accounts
    .filter((a) => a.is_archived)
    .map((account) => toRowView(account, balanceOf(account)));

  return (
    <div className="flex flex-col gap-6">
      <AccountSummaryCard
        total={total}
        activeCount={activeCount}
        balancesIncomplete={balancesIncomplete}
      />
      <AccountManager sections={sections} archived={archived} />
    </div>
  );
}

// Honest empty state: only shown when the user truly has zero accounts.
function AccountsEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-container-lowest p-lg text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name="account_balance_wallet" size={28} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-title-md text-on-surface">Belum ada rekening</p>
        <p className="max-w-xs text-body-sm text-on-surface-variant">
          Tambahkan rekening pertamamu untuk mulai mencatat saldo.
        </p>
      </div>
      <Button asChild className="h-11">
        <Link href="/accounts/new">
          <Icon name="add" size={20} />
          Tambah rekening
        </Link>
      </Button>
    </div>
  );
}

function AccountsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/accounts">Muat ulang</Link>
      </Button>
    </div>
  );
}
