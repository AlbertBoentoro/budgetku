import { Suspense } from "react";
import Link from "next/link";
import { Plus, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { computeAccountBalances, type AccountRow } from "@/lib/accounts";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountList } from "@/components/finance/account-list";
import { Button } from "@/components/ui/button";
import { AccountsLoading } from "@/app/(app)/accounts/loading";

export default function AccountsPage() {
  return (
    <>
      <AppHeader
        title="Rekening"
        action={
          <Button asChild size="sm" className="h-9">
            <Link href="/accounts/new">
              <Plus aria-hidden />
              Tambah rekening
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <Suspense fallback={<AccountsLoading />}>
          <AccountsContent />
        </Suspense>
      </PageContainer>
    </>
  );
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
    return (
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
    );
  }

  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);

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

  return (
    <AccountList
      active={active}
      archived={archived}
      balances={balances}
      balancesIncomplete={balancesIncomplete}
    />
  );
}

function AccountsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/accounts">Muat ulang</Link>
      </Button>
    </div>
  );
}
