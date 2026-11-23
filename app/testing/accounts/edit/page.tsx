import Link from "next/link";
import { notFound } from "next/navigation";

import { isPublicTestingDemoAllowed } from "@/lib/auth/public-testing-demo";
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from "@/lib/testing/demo-budgetku-data";
import { computeTransactionEffects } from "@/lib/account-balance-math";
import { runningBalanceFromOpening } from "@/lib/account-balance-adjustment";
import { AccountForm, type AccountFormInitialValues } from "@/components/finance/account-form";
import type { AccountFormInput, ActionResult } from "@/app/(app)/accounts/actions";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AppBackLink } from "@/components/layout/app-back-link";

// The gallery deliberately has no database client or mutation.
async function demoAccountEdit(_input: AccountFormInput): Promise<ActionResult> {
  "use server";
  void _input;
  return {
    ok: false,
    message: "Mode demo tanpa login. Input dapat dicoba, tetapi perubahan tidak disimpan.",
  };
}

export default function DemoAccountEditPage() {
  if (!isPublicTestingDemoAllowed()) notFound();

  const account = DEMO_ACCOUNTS[0];
  const effects = computeTransactionEffects(DEMO_TRANSACTIONS);
  const currentBalance = runningBalanceFromOpening(
    account.initial_balance,
    effects.get(account.id) ?? 0,
  );
  if (currentBalance === null) notFound();

  const initialValues: AccountFormInitialValues = {
    name: account.name,
    account_type: account.account_type,
    initial_balance: account.initial_balance,
    current_balance: currentBalance,
  };

  return (
    <main className="min-h-dvh pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AppHeader
        title="Ubah rekening (Demo)"
        titleAction={<AppBackLink href="/testing" label="Kembali ke testing" />}
      />
      <PageContainer>
        <p className="mb-5 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm">
          <strong>Tanpa login · data contoh.</strong> Saldo awal rekening contoh adalah{" "}
          Rp{account.initial_balance.toLocaleString("id-ID")}, sedangkan form menampilkan
          saldo terkini Rp{currentBalance.toLocaleString("id-ID")} setelah transaksi.
          Tidak ada data yang disimpan.
          {" "}<Link href="/testing" className="underline">Kembali ke demo</Link>
        </p>
        <AccountForm mode="edit" action={demoAccountEdit} initialValues={initialValues} cancelHref="/testing" />
      </PageContainer>
    </main>
  );
}
