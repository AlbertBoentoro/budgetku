import { Suspense } from "react";
import Link from "next/link";
import { Plus, PieChart } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  computeBudgetTotals,
  computeCategorySpending,
  computeItemUsage,
  fetchBudgetForMonth,
  fetchBudgetItems,
  resolveMonthParam,
  toMonthStorage,
  type BudgetItemView,
  type CategoryRow,
} from "@/lib/budgets";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetMonthSwitcher } from "@/components/finance/budget-month-switcher";
import { BudgetSummary } from "@/components/finance/budget-summary";
import { BudgetItemList } from "@/components/finance/budget-item-list";
import { Button } from "@/components/ui/button";
import { BudgetLoading } from "@/app/(app)/budget/loading";

type SearchParams = Record<string, string | string[] | undefined>;

export default function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <AppHeader title="Anggaran" />
      <PageContainer>
        <Suspense fallback={<BudgetLoading />}>
          <BudgetContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function BudgetContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const monthParam = resolveMonthParam(resolvedSearchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the query strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <BudgetError message="Sesi berakhir. Silakan masuk kembali untuk melihat anggaran." />
    );
  }

  const budget = await fetchBudgetForMonth(
    supabase,
    user.id,
    toMonthStorage(monthParam),
  );

  // Empty — no budget for the month. Distinct from the no-items state below.
  if (!budget) {
    return (
      <div className="flex flex-col gap-6">
        <BudgetMonthSwitcher monthParam={monthParam} />
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            icon={PieChart}
            title="Belum ada anggaran untuk bulan ini"
            description="Buat anggaran bulan ini untuk menetapkan batas pengeluaran per kategori."
          />
          <Button asChild className="h-11">
            <Link href={`/budget/new?month=${monthParam}`}>
              <Plus aria-hidden />
              Tambah anggaran
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const items = await fetchBudgetItems(supabase, user.id, budget.id);

  // De-duplicate defensively by category_id (first item per category wins) so
  // a race that produced a duplicate never doubles a category in the view.
  const seenCategories = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (seenCategories.has(item.category_id)) return false;
    seenCategories.add(item.category_id);
    return true;
  });

  // Resolve category names for the referenced categories (own, system, or
  // archived) in a single follow-up lookup.
  const categoryNameById = new Map<string, string>();
  const categoryIds = uniqueItems.map((item) => item.category_id);
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", categoryIds);
    for (const c of (cats ?? []) as Pick<CategoryRow, "id" | "name">[]) {
      categoryNameById.set(c.id, c.name);
    }
  }

  // Real spending per category for the month. On failure, degrade to an
  // incomplete notice (spent treated as 0) rather than crashing the page.
  let spending = new Map<string, number>();
  let spendingIncomplete = false;
  try {
    spending = await computeCategorySpending(
      supabase,
      user.id,
      monthParam,
      categoryIds,
    );
  } catch {
    spendingIncomplete = true;
  }

  const views: BudgetItemView[] = uniqueItems.map((item) => {
    const planned = Number(item.planned_amount);
    const spent = spending.get(item.category_id) ?? 0;
    return {
      ...item,
      categoryName: categoryNameById.get(item.category_id) ?? null,
      usage: computeItemUsage(planned, spent),
    };
  });

  const totals = computeBudgetTotals(views);

  return (
    <div className="flex flex-col gap-6">
      <BudgetMonthSwitcher monthParam={monthParam} />

      <BudgetSummary totals={totals} incomplete={spendingIncomplete} />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Batas per kategori
        </h2>
        <Button asChild size="sm" className="h-9">
          <Link href={`/budget/items/new?month=${monthParam}`}>
            <Plus aria-hidden />
            Tambah kategori
          </Link>
        </Button>
      </div>

      {views.length === 0 ? (
        // Empty — budget exists but has no category limits yet.
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            icon={PieChart}
            title="Belum ada batas kategori"
            description="Tambahkan batas pengeluaran untuk kategori pertamamu."
          />
          <Button asChild className="h-11">
            <Link href={`/budget/items/new?month=${monthParam}`}>
              <Plus aria-hidden />
              Tambah kategori
            </Link>
          </Button>
        </div>
      ) : (
        <BudgetItemList items={views} monthParam={monthParam} />
      )}
    </div>
  );
}

function BudgetError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/budget">Muat ulang</Link>
      </Button>
    </div>
  );
}
