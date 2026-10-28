import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveAccounts,
  fetchUsableCategories,
} from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionForm } from "@/components/finance/transaction-form";
import { createTransaction } from "@/app/(app)/transactions/actions";
import { AppBackLink } from "@/components/layout/app-back-link";
import { Button } from "@/components/ui/button";

export default function NewTransactionPage() {
  return (
    <>
      <AppHeader
        title="Tambah transaksi"
        titleAction={
          <AppBackLink href="/transactions" label="Kembali ke Transaksi" />
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
  // Request-time work: creating the Supabase client reads the clock (session
  // expiry), which partialPrefetching rejects before connection().
  await connection();

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
