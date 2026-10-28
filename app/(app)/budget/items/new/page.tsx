import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  addBudgetItem,
  type BudgetItemFormInput,
  type ActionResult,
} from "@/app/(app)/budget/actions";
import {
  currentMonthParam,
  fetchBudgetForMonth,
  fetchBudgetItems,
  fetchExpenseCategories,
  isMonthParam,
  toMonthStorage,
} from "@/lib/budgets";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { BudgetItemForm } from "@/components/finance/budget-item-form";
import { Button } from "@/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

export default function NewBudgetItemPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <AppHeader
        title="Tambah kategori"
        titleAction={
          <AppBackLink href="/budget" label="Kembali ke Anggaran" />
        }
      />
      <PageContainer>
        <Suspense fallback={<FormSkeleton />}>
          <NewBudgetItemContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function NewBudgetItemContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Request-time work: the current-month fallback and the Supabase client both
  // read the clock, which partialPrefetching rejects before connection().
  await connection();

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

  const budget = await fetchBudgetForMonth(
    supabase,
    user.id,
    toMonthStorage(monthParam),
  );

  // No budget yet for this month: guide the user to create one first instead
  // of adding an item that has nowhere to attach.
  if (!budget) {
    return <NoBudgetState monthParam={monthParam} />;
  }

  const budgetId = budget.id;

  const [categories, existingItems] = await Promise.all([
    fetchExpenseCategories(supabase, user.id),
    fetchBudgetItems(supabase, user.id, budgetId),
  ]);

  // No expense categories available to budget at all.
  if (categories.length === 0) {
    return <NoCategoriesState monthParam={monthParam} />;
  }

  const usedCategoryIds = existingItems.map((item) => item.category_id);

  // Bound server action: budget id is fixed server-side; addBudgetItem
  // re-checks ownership, category usability, and the duplicate guard.
  async function action(input: BudgetItemFormInput): Promise<ActionResult> {
    "use server";
    return addBudgetItem(budgetId, input);
  }

  return (
    <BudgetItemForm
      mode="create"
      action={action}
      categories={categories}
      monthParam={monthParam}
      usedCategoryIds={usedCategoryIds}
    />
  );
}

function FormSkeleton() {
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

function NoBudgetState({ monthParam }: { monthParam: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Buat anggaran bulan ini terlebih dahulu sebelum menambah batas kategori.
      </p>
      <Button asChild className="h-11">
        <Link href={`/budget/new?month=${monthParam}`}>Tambah anggaran</Link>
      </Button>
    </div>
  );
}

function NoCategoriesState({ monthParam }: { monthParam: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Belum ada kategori pengeluaran yang bisa dianggarkan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href={`/budget?month=${monthParam}`}>Kembali ke anggaran</Link>
      </Button>
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
        Sesi berakhir. Silakan masuk kembali untuk menambah batas kategori.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/budget">Kembali ke anggaran</Link>
      </Button>
    </div>
  );
}
