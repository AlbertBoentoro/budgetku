import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveAccounts,
  fetchUsableCategories,
  type RecurringRow,
} from "@/lib/recurring";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import {
  RecurringForm,
  type RecurringFormInitialValues,
} from "@/components/finance/recurring-form";
import {
  updateRecurring,
  type RecurringFormInput,
} from "@/app/(app)/recurring/actions";
import { Button } from "@/components/ui/button";

interface EditRecurringPageProps {
  params: Promise<{ id: string }>;
}

export default function EditRecurringPage({ params }: EditRecurringPageProps) {
  return (
    <>
      <AppHeader title="Ubah transaksi berulang" />
      <PageContainer>
        {/* The dynamic auth + template fetch runs inside Suspense so the shared
            (app) shell can still prerender under PPR. */}
        <Suspense fallback={<EditFormSkeleton />}>
          <EditRecurringContent params={params} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function EditRecurringContent({ params }: EditRecurringPageProps) {
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
    .from("recurring_transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return <NotFoundState />;
  }

  const template = data as RecurringRow;

  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    fetchActiveAccounts(supabase, user.id),
    fetchUsableCategories(supabase, user.id, "income"),
    fetchUsableCategories(supabase, user.id, "expense"),
  ]);

  const initialValues: RecurringFormInitialValues = {
    name: template.name,
    transaction_type: template.transaction_type,
    amount: template.amount,
    account_id: template.account_id,
    destination_account_id: template.destination_account_id,
    category_id: template.category_id,
    frequency: template.frequency,
    interval_count: template.interval_count,
    start_date: template.start_date,
    end_date: template.end_date,
    next_due_date: template.next_due_date,
    auto_create: template.auto_create,
    is_active: template.is_active,
    description: template.description,
    merchant: template.merchant,
  };

  // Bound server action: the id is fixed server-side, the client only sends the
  // form input. updateRecurring re-checks ownership before writing.
  async function action(input: RecurringFormInput) {
    "use server";
    return updateRecurring(id, input);
  }

  return (
    <RecurringForm
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
      {Array.from({ length: 5 }).map((_, i) => (
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
        Transaksi berulang tidak ditemukan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/recurring">Kembali ke transaksi berulang</Link>
      </Button>
    </div>
  );
}
