import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";

import { isStagingEmailLoginAllowed } from "@/lib/auth/staging-email-login";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionForm } from "@/components/finance/transaction-form";
import type { ActionResult, TransactionFormInput } from "@/app/(app)/transactions/actions";
import {
  DEMO_ACCOUNTS,
  DEMO_EXPENSE_CATEGORIES,
  DEMO_INCOME_CATEGORIES,
  DEMO_TRANSACTIONS,
} from "@/lib/testing/demo-budgetku-data";

/** Never writes to Supabase, even if a form action is called directly. */
async function doNotSaveInDemo(_input: TransactionFormInput): Promise<ActionResult> {
  "use server";
  void _input;
  if (!isStagingEmailLoginAllowed()) {
    return { ok: false, message: "Halaman demo tidak tersedia di production." };
  }
  return {
    ok: false,
    message: "Mode demo hanya untuk memeriksa UI. Data tidak disimpan. Untuk transaksi asli, masuk ke akun testing.",
  };
}

export default function NoLoginTransactionDemo() {
  // The public, fixture-only route MUST NOT be active under production.
  if (!isStagingEmailLoginAllowed()) notFound();

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader
        title="Tambah transaksi"
        titleAction={<AppBackLink href="/testing" label="Kembali ke demo" />}
      />
      <PageContainer>
        <Suspense fallback={<p className="text-body-sm text-on-surface-variant">Memuat demo transaksi…</p>}>
          <DemoTransactionContent />
        </Suspense>
      </PageContainer>
    </main>
  );
}

async function DemoTransactionContent() {
  // The real form initializes date state from new Date(). In Next 16 PPR it
  // must render under a request-time Suspense boundary, like the real page.
  await connection();
  return (
    <>
      <div role="note" className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface">
          <strong>Demo tanpa login</strong> — rekening dan transaksi contoh sudah terisi.
          Coba <strong>Duplikat transaksi sebelumnya</strong> dan <strong>Pilih kategori</strong>.
          Tidak mengubah database atau saldo.
          <span className="ml-1">
            <Link href="/testing" className="font-medium underline">Kembali ke data contoh</Link>
          </span>
        </div>
        <TransactionForm
          mode="create"
          action={doNotSaveInDemo}
          accounts={DEMO_ACCOUNTS}
          incomeCategories={DEMO_INCOME_CATEGORIES}
          expenseCategories={DEMO_EXPENSE_CATEGORIES}
          recentTransactions={DEMO_TRANSACTIONS}
          currentMonth="2026-11"
        />
    </>
  );
}
