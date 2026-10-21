import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import type { AccountRow } from "@/lib/accounts";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import {
  AccountForm,
  type AccountFormInitialValues,
} from "@/components/finance/account-form";
import { updateAccount, type AccountFormInput } from "@/app/(app)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface EditAccountPageProps {
  params: Promise<{ id: string }>;
}

export default function EditAccountPage({ params }: EditAccountPageProps) {
  return (
    <>
      <AppHeader title="Ubah rekening" />
      <PageContainer>
        {/* The dynamic auth + account fetch runs inside Suspense so the shared
            (app) shell (BottomNav uses usePathname) can still prerender. */}
        <Suspense fallback={<EditFormSkeleton />}>
          <EditAccountContent params={params} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function EditAccountContent({ params }: EditAccountPageProps) {
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
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return <NotFoundState />;
  }

  const account = data as AccountRow;

  const initialValues: AccountFormInitialValues = {
    name: account.name,
    account_type: account.account_type,
    initial_balance: account.initial_balance,
    include_in_total: account.include_in_total,
  };

  // Bound server action: the id is fixed server-side, the client only sends
  // the form input. updateAccount re-checks ownership before writing.
  async function action(input: AccountFormInput) {
    "use server";
    return updateAccount(id, input);
  }

  // Read-only entry to this account's ledger, placed above the form so it is
  // not mistaken for a form action next to Simpan/Batal.
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="outline" className="h-11 w-full">
        <Link href={`/transactions?account=${encodeURIComponent(account.id)}`}>
          <Icon name="receipt_long" size={18} />
          Riwayat transaksi
        </Link>
      </Button>
      <AccountForm mode="edit" action={action} initialValues={initialValues} />
    </div>
  );
}

function EditFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
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
        Rekening tidak ditemukan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/accounts">Kembali ke rekening</Link>
      </Button>
    </div>
  );
}
