import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { MissingTransactionsRecovery } from "@/components/transactions/missing-transactions-recovery";

export default function RecoverTransactionsPage() {
  return (
    <>
      <AppHeader title="Pulihkan transaksi" titleAction={
        <AppBackLink href="/transactions" label="Kembali ke Transaksi" />
      } />
      <PageContainer className="pb-8">
        <Suspense fallback={<p className="text-body-sm text-on-surface-variant">Memuat pemulihan...</p>}>
          <MissingTransactionsRecovery />
        </Suspense>
      </PageContainer>
    </>
  );
}
