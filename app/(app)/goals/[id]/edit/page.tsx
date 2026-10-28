import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { fetchActiveAccounts } from "@/lib/transactions";
import type { GoalRow } from "@/lib/goals";
import { updateGoal, type GoalFormInput } from "@/app/(app)/goals/actions";
import { AppBackLink } from "@/components/layout/app-back-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import {
  GoalForm,
  type GoalFormInitialValues,
} from "@/components/finance/goal-form";
import { Button } from "@/components/ui/button";

interface EditGoalPageProps {
  params: Promise<{ id: string }>;
}

export default function EditGoalPage({ params }: EditGoalPageProps) {
  return (
    <>
      <AppHeader
        title="Ubah target"
        titleAction={
          <AppBackLink href="/goals" label="Kembali ke Target Tabungan" />
        }
      />
      <PageContainer>
        <Suspense fallback={<EditFormSkeleton />}>
          <EditGoalContent params={params} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function EditGoalContent({ params }: EditGoalPageProps) {
  // Request-time work: creating the Supabase client reads the clock (session
  // expiry), which partialPrefetching rejects before connection().
  await connection();

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
    .from("financial_goals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return <NotFoundState />;
  }

  const goal = data as GoalRow;
  const accounts = await fetchActiveAccounts(supabase, user.id);

  const initialValues: GoalFormInitialValues = {
    name: goal.name,
    target_amount: goal.target_amount,
    target_date: goal.target_date,
    account_id: goal.account_id,
    notes: goal.notes,
    status: goal.status,
    icon: goal.icon,
  };

  // Bound server action: the id is fixed server-side, the client only sends the
  // form input. updateGoal re-checks ownership before writing.
  async function action(input: GoalFormInput) {
    "use server";
    return updateGoal(id, input);
  }

  return (
    <GoalForm
      mode="edit"
      action={action}
      accounts={accounts}
      initialValues={initialValues}
    />
  );
}

function EditFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
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
        Target tidak ditemukan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/goals">Kembali ke target</Link>
      </Button>
    </div>
  );
}
