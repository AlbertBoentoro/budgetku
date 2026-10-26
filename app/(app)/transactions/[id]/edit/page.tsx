import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveAccounts,
  fetchUsableCategories,
  type TransactionRow,
} from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import {
  TransactionForm,
  type TransactionFormInitialValues,
} from "@/components/finance/transaction-form";
import {
  updateTransaction,
  type TransactionFormInput,
} from "@/app/(app)/transactions/actions";
import { AppBackLink } from "@/components/layout/app-back-link";
import { Button } from "@/components/ui/button";

interface EditTransactionPageProps {
  params: Promise<{ id: string }>;
}

export default function EditTransactionPage({
  params,
}: EditTransactionPageProps) {
  return (
    <>
      <AppHeader
        title="Ubah transaksi"
        titleAction={
          <AppBackLink href="/transactions" label="Kembali ke Transaksi" />
        }
      />
      <PageContainer>
        {/* The dynamic auth + transaction fetch runs inside Suspense so the
            shared (app) shell can still prerender under PPR. */}
        <Suspense fallback={<EditFormSkeleton />}>
          <EditTransactionContent params={params} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function EditTransactionContent({ params }: EditTransactionPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <NotFoundState />;
  }

  // Scope by id AND user_id: another user's id returns no row, which is also
  // the ownership-isolation path (no leak, no crash).
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return <NotFoundState />;
  }

  const transaction = data as TransactionRow;

  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    fetchActiveAccounts(supabase, user.id),
    fetchUsableCategories(supabase, user.id, "income"),
    fetchUsableCategories(supabase, user.id, "expense"),
  ]);

  const initialValues: TransactionFormInitialValues = {
    transaction_type: transaction.transaction_type,
    amount: transaction.amount,
    account_id: transaction.account_id,
    destination_account_id: transaction.destination_account_id,
    category_id: transaction.category_id,
    transaction_at: transaction.transaction_at,
    description: transaction.description,
    merchant: transaction.merchant,
  };

  // Bound server action: the id is fixed server-side, the client only sends
  // the form input. updateTransaction re-checks ownership before writing.
  async function action(input: TransactionFormInput) {
    "use server";
    return updateTransaction(id, input);
  }

  return (
    <TransactionForm
      mode="edit"
      action={action}
      accounts={accounts}
      incomeCategories={incomeCategories}
      expenseCategories={expenseCategories}
      initialValues={initialValues}
    />
  );
}

function EditFormSkeleton() {
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

function NotFoundState() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Transaksi tidak ditemukan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/transactions">Kembali ke transaksi</Link>
      </Button>
    </div>
  );
}
