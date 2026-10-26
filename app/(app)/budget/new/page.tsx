import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createBudget,
  type ActionResult,
} from "@/app/(app)/budget/actions";
import {
  currentMonthParam,
  fetchBudgetForMonth,
  formatMonthLabel,
  isMonthParam,
  toMonthStorage,
} from "@/lib/budgets";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { NewBudgetForm } from "@/components/finance/new-budget-form";
import { Button } from "@/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

export default function NewBudgetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <AppHeader
        title="Tambah anggaran"
        titleAction={
          <AppBackLink href="/budget" label="Kembali ke Anggaran" />
        }
      />
      <PageContainer>
        <Suspense fallback={<NewBudgetSkeleton />}>
          <NewBudgetContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function NewBudgetContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  const rawMonth = Array.isArray(resolved.month)
    ? resolved.month[0]
    : resolved.month;
  const monthParam =
    rawMonth && isMonthParam(rawMonth) ? rawMonth : currentMonthParam();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SessionExpiredState />;
  }

  // One budget per month: if it already exists, send the user to that budget
  // rather than letting them create a duplicate.
  const existing = await fetchBudgetForMonth(
    supabase,
    user.id,
    toMonthStorage(monthParam),
  );
  if (existing) {
    redirect(`/budget?month=${monthParam}`);
  }

  // Bound server action: the month is fixed server-side; the client only sends
  // the optional notes.
  async function action(notes?: string): Promise<ActionResult> {
    "use server";
    return createBudget(monthParam, undefined, notes);
  }

  return (
    <NewBudgetForm
      action={action}
      monthParam={monthParam}
      monthLabel={formatMonthLabel(monthParam)}
    />
  );
}

function NewBudgetSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-11 w-full rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}

function SessionExpiredState() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">
        Sesi berakhir. Silakan masuk kembali untuk membuat anggaran.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/budget">Kembali ke anggaran</Link>
      </Button>
    </div>
  );
}
