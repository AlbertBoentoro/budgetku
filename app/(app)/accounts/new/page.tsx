import { AppBackLink } from "@/components/layout/app-back-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AccountForm } from "@/components/finance/account-form";
import { createAccount } from "@/app/(app)/accounts/actions";

export default function NewAccountPage() {
  return (
    <>
      <AppHeader
        title="Tambah rekening"
        titleAction={
          <AppBackLink href="/accounts" label="Kembali ke Rekening" />
        }
      />
      <PageContainer>
        <AccountForm mode="create" action={createAccount} />
      </PageContainer>
    </>
  );
}
