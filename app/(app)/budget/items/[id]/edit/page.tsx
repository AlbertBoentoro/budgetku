import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  updateBudgetItem,
  type BudgetItemFormInput,
  type ActionResult,
} from "@/app/(app)/budget/actions";
import {
  currentMonthParam,
  fetchBudgetItems,
  fetchExpenseCategories,
  isMonthParam,
  toMonthParam,
  type BudgetItemRow,
  type BudgetRow,
} from "@/lib/budgets";
import {
  BudgetItemForm,
  type BudgetItemFormInitialValues,
} from "@/components/finance/budget-item-form";
import { AppHeader } from "@/components/layout/app-header";
import { AppBackLink } from "@/components/layout/app-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

interface EditBudgetItemPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

export default function EditBudgetItemPage({
  params,
  searchParams,
}: EditBudgetItemPageProps) {
  return (
    <>
      <AppHeader
        title="Ubah batas kategori"
        titleAction={
          <AppBackLink href="/budget" label="Kembali ke Anggaran" />
        }
      />
      <PageContainer>
        <Suspense fallback={<FormSkeleton />}>
          <EditBudgetItemContent params={params} searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function EditBudgetItemContent({
  params,
  searchParams,
}: EditBudgetItemPageProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const rawMonth = Array.isArray(resolved.month)
    ? resolved.month[0]
    : resolved.month;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <NotFoundState monthParam={currentMonthParam()} />;
  }

  // Scope by id AND user_id: another user's id returns no row, which is also
  // the ownership-isolation path (no leak, no crash).
  const { data: itemData, error: itemError } = await supabase
    .from("budget_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError || !itemData) {
    const fallbackMonth =
      rawMonth && isMonthParam(rawMonth) ? rawMonth : currentMonthParam();
    return <NotFoundState monthParam={fallbackMonth} />;
  }

  const item = itemData as BudgetItemRow;

  // Resolve the month from the item's budget so navigation/back links are
  // correct even if the URL ?month= was absent or stale.
  const { data: budgetData } = await supabase
    .from("budgets")
    .select("id, month")
    .eq("id", item.budget_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const budget = budgetData as Pick<BudgetRow, "id" | "month"> | null;
  const monthParam = budget
    ? toMonthParam(budget.month)
    : rawMonth && isMonthParam(rawMonth)
      ? rawMonth
      : currentMonthParam();

  const [categories, siblingItems] = await Promise.all([
    fetchExpenseCategories(supabase, user.id),
    fetchBudgetItems(supabase, user.id, item.budget_id),
  ]);

  // Categories already used by other items in this budget (excluding this one),
  // so the form prevents re-selecting a category that would duplicate.
  const usedCategoryIds = siblingItems
    .filter((sibling) => sibling.id !== item.id)
    .map((sibling) => sibling.category_id);

  const initialValues: BudgetItemFormInitialValues = {
    category_id: item.category_id,
    planned_amount: item.planned_amount,
    is_fixed: item.is_fixed,
    notes: item.notes,
  };

  // Bound server action: the item id is fixed server-side; updateBudgetItem
  // re-checks ownership, category usability, and the duplicate guard.
  async function action(input: BudgetItemFormInput): Promise<ActionResult> {
    "use server";
    return updateBudgetItem(id, input);
  }

  return (
    <BudgetItemForm
      mode="edit"
      action={action}
      categories={categories}
      monthParam={monthParam}
      usedCategoryIds={usedCategoryIds}
      initialValues={initialValues}
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

function NotFoundState({ monthParam }: { monthParam: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Batas kategori tidak ditemukan.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href={`/budget?month=${monthParam}`}>Kembali ke anggaran</Link>
      </Button>
    </div>
  );
}
