import Link from "next/link";
import { notFound } from "next/navigation";

import { isPublicTestingDemoAllowed } from "@/lib/auth/public-testing-demo";
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from "@/lib/testing/demo-budgetku-data";
import { computeTransactionEffects } from "@/lib/account-balance-math";
import { runningBalanceFromOpening } from "@/lib/account-balance-adjustment";
import { AmountText } from "@/components/finance/amount-text";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Read-only synthetic account list for testing the same interaction as real
 * accounts: tapping the row opens history, and Edit stays in the actions menu.
 * No account IDs or balances are fetched from a Supabase session here.
 */
export default function TestingAccountsPage() {
  if (!isPublicTestingDemoAllowed()) notFound();

  const account = DEMO_ACCOUNTS[0];
  const effects = computeTransactionEffects(DEMO_TRANSACTIONS);
  const balance = runningBalanceFromOpening(
    account.initial_balance,
    effects.get(account.id) ?? 0,
  );
  if (balance === null) notFound();

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader
        title="Rekening (Demo)"
        titleAction={<AppBackLink href="/testing" label="Kembali ke testing" />}
      />
      <PageContainer>
        <div className="flex flex-col gap-5">
          <p className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface">
            <strong>Data dummy · tanpa login.</strong> Klik nama atau saldo rekening
            untuk melihat riwayat transaksi. Klik tiga titik untuk mencoba
            form Edit. Semua contoh bersifat read-only.
          </p>

          <section aria-label="Rekening contoh" className="rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center gap-3 px-4 py-3">
              <Link
                href={`/testing/accounts/history/${account.id}`}
                aria-label={`Lihat riwayat transaksi ${account.name}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-account-blue">
                  <Icon name="account_balance" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-md text-on-surface">{account.name}</span>
                  <span className="text-body-sm text-on-surface-variant">Bank</span>
                  <span className="text-label-xs text-on-surface-variant">Lihat riwayat transaksi</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-currency-body">
                    <AmountText value={balance} size="none" className="text-on-surface" />
                  </span>
                  <span className="text-label-xs text-on-surface-variant">Aktif</span>
                </span>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 text-on-surface-variant"
                    aria-label={`Aksi untuk ${account.name}`}
                  >
                    <Icon name="more_vert" size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link href="/testing/accounts/edit">
                      <Icon name="edit" size={18} />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>

          <p className="text-body-sm text-on-surface-variant">
            Ini hanya simulasi navigasi. Pada aplikasi yang menggunakan akun,
            Edit, Arsipkan, dan Hapus tetap tersedia sesuai aturan rekening.
          </p>
        </div>
      </PageContainer>
    </main>
  );
}
