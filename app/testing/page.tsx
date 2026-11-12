import Link from "next/link";
import { notFound } from "next/navigation";

import { isStagingEmailLoginAllowed } from "@/lib/auth/staging-email-login";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from "@/lib/testing/demo-budgetku-data";

/** Read-only, completely synthetic testing gallery; never exposes staging user data. */
export default function TestingDemoHome() {
  if (!isStagingEmailLoginAllowed()) notFound();

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader title="Budgetku Testing" subtitle="Demo tanpa login · data contoh" />
      <PageContainer>
        <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <h2 className="text-title-md font-semibold">Akun contoh sudah terisi</h2>
          <p className="text-body-sm text-on-surface-variant">
            Data di sini hanya fixture sintetis yang mirip dataset staging.
            Ini bukan sesi akun Gmail milik siapa pun, dan tidak terhubung ke saldo asli.
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <span key={account.id} className="rounded-full border border-outline-variant px-3 py-2 text-body-sm">
                {account.name}
              </span>
            ))}
          </div>
          <Link
            href="/testing/transactions/new"
            className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary"
          >
            Buka Tambah transaksi dan Duplikat
          </Link>
        </div>
        <section className="flex flex-col gap-3" aria-label="Riwayat contoh">
          <h2 className="text-title-md font-semibold">7 transaksi contoh</h2>
          {DEMO_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{tx.merchant || tx.description}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {tx.transaction_at.slice(0, 10)} · {tx.transaction_type === "income" ? "Pemasukan" : "Pengeluaran"}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {tx.transaction_type === "expense" ? "-" : "+"}
                Rp{tx.amount.toLocaleString("id-ID")}
              </p>
            </div>
          ))}
        </section>
      </PageContainer>
    </main>
  );
}
