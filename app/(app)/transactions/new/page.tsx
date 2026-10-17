import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveAccounts,
  fetchUsableCategories,
} from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionForm } from "@/components/finance/transaction-form";
import { createTransaction } from "@/app/(app)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default function NewTransactionPage() {
  return (
    <>
      <AppHeader
        title="Tambah transaksi"
        action={
          <Link
            href="/transactions"
            aria-label="Kembali"
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="arrow_back" size={22} />
          </Link>
        }
      />
      <PageContainer>
        {/* The dynamic auth + data fetch runs inside Suspense so the shared
            (app) shell can still prerender under PPR. */}
        <Suspense fallback={<NewFormSkeleton />}>
          <NewTransactionContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function NewTransactionContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SessionExpiredState />;
  }

  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    fetchActiveAccounts(supabase, user.id),
    fetchUsableCategories(supabase, user.id, "income"),
    fetchUsableCategories(supabase, user.id, "expense"),
  ]);

  // A transaction needs a source account. Without one, point the user to add a
  // rekening first instead of rendering a form that cannot be submitted.
  if (accounts.length === 0) {
    return <NoAccountsState />;
  }

  return (
    <TransactionForm
      mode="create"
      action={createTransaction}
      accounts={accounts}
      incomeCategories={incomeCategories}
      expenseCategories={expenseCategories}
    />
  );
}

function NewFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-11 w-full rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}

function NoAccountsState() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Tambahkan rekening terlebih dahulu sebelum mencatat transaksi.
      </p>
      <Button asChild className="h-11">
        <Link href="/accounts/new">Tambah rekening</Link>
      </Button>
    </div>
  );
}

function SessionExpiredState() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">
        Sesi berakhir. Silakan masuk kembali untuk mencatat transaksi.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/transactions">Kembali ke transaksi</Link>
      </Button>
    </div>
  );
}
