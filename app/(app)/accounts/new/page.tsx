import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AccountForm } from "@/components/finance/account-form";
import { createAccount } from "@/app/(app)/accounts/actions";

export default function NewAccountPage() {
  return (
    <>
      <AppHeader title="Tambah rekening" />
      <PageContainer>
        <AccountForm mode="create" action={createAccount} />
      </PageContainer>
    </>
  );
}
