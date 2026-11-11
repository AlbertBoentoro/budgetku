import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { fetchActiveAccounts, fetchUsableCategories } from "@/lib/transactions";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import {
  DuplicateTransactionPicker,
  type DuplicableRow,
} from "@/components/finance/transaction-duplicate-picker";

export default function DuplicateTransactionPage() {
  return (
    <>
      <AppHeader
        title="Duplikat transaksi"
        titleAction={<AppBackLink href="/transactions/new?restore=back" label="Kembali ke Catat" />}
      />
      <PageContainer className="pb-8">
        <Suspense fallback={<p className="text-body-sm text-on-surface-variant">Memuat transaksi…</p>}>
          <DuplicateContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function DuplicateContent() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (
    <p role="alert">Sesi berakhir. <Link href="/auth/login" className="underline">Masuk kembali</Link>.</p>
  );

  // Only rows owned by the authenticated user; no Gmail IDs or source fields
  // are fetched, so "duplicate" cannot reuse imported email idempotency data.
  const [transactions, accounts, incomeCategories, expenseCategories] = await Promise.all([
    supabase.from("transactions")
      .select("id, transaction_type, amount, transaction_at, account_id, destination_account_id, category_id, merchant, description")
      .eq("user_id", user.id)
      .order("transaction_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    fetchActiveAccounts(supabase, user.id),
    fetchUsableCategories(supabase, user.id, "income"),
    fetchUsableCategories(supabase, user.id, "expense"),
  ]);
  if (transactions.error) {
    return <p role="alert" className="text-body-sm text-expense">Transaksi belum dapat dimuat. Coba lagi.</p>;
  }

  return (
    <DuplicateTransactionPicker
      transactions={(transactions.data ?? []) as DuplicableRow[]}
      accounts={accounts}
      categories={[...expenseCategories, ...incomeCategories]}
    />
  );
}
