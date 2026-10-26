import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  computeBudgetTotals,
  computeCategorySpending,
  computeItemUsage,
  fetchBudgetForMonth,
  fetchBudgetItems,
  monthRemainingDays,
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
import { Icon } from "@/components/ui/icon";
import { BudgetLoading } from "@/app/(app)/budget/loading";

type SearchParams = Record<string, string | string[] | undefined>;

export default function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <AppHeader
        title="Anggaran"
        action={
          // Goals (Target Tabungan) lives under Budget: both are money
          // planning. Reachable here instead of taking a bottom-nav slot. The
          // mockup's right-side Target link is satisfied by this header action
          // (one placement, not duplicated below the month row).
          <Button asChild variant="ghost" size="sm" className="h-11 text-secondary">
            <Link href="/goals">
              <Icon name="savings" size={18} />
              Target Tabungan
              <Icon name="arrow_forward" size={18} />
            </Link>
          </Button>
        }
      />
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
          <div className="flex flex-col items-center gap-2 pt-6">
            <Icon name="savings" size={28} className="text-on-surface-variant" />
            <EmptyState
              title="Belum ada anggaran untuk bulan ini"
              description="Buat anggaran bulan ini untuk menetapkan batas pengeluaran per kategori."
              className="py-0"
            />
          </div>
          <Button asChild className="h-11">
            <Link href={`/budget/new?month=${monthParam}`}>
              <Icon name="add" size={20} />
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

  // Real days left in the selected month (date math, not money). Only shown for
  // the current/future month (N > 0); past months show no "days left" line.
  const daysLeft = monthRemainingDays(monthParam);

  return (
    <div className="flex flex-col gap-6">
      <BudgetMonthSwitcher monthParam={monthParam} />

      <div className="flex flex-col gap-2">
        <BudgetSummary totals={totals} incomplete={spendingIncomplete} />
        {daysLeft > 0 ? (
          <p className="px-1 text-body-sm text-on-surface-variant">
            Tersisa {daysLeft} hari bulan ini.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-title-md text-on-surface">
            Batas Pengeluaran Kategori
          </h2>
          <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-md text-on-surface-variant">
            {views.length} Pos
          </span>
        </div>
      </div>

      {views.length === 0 ? (
        // Empty — budget exists but has no category limits yet.
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2 pt-2">
            <Icon name="category" size={28} className="text-on-surface-variant" />
            <EmptyState
              title="Belum ada batas kategori"
              description="Tambahkan batas pengeluaran untuk kategori pertamamu."
              className="py-0"
            />
          </div>
          <Button asChild className="h-11 w-full">
            <Link href={`/budget/items/new?month=${monthParam}`}>
              <Icon name="add" size={20} />
              Atur Anggaran Kategori
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <BudgetItemList items={views} monthParam={monthParam} />
          <Button asChild className="h-11 w-full">
            <Link href={`/budget/items/new?month=${monthParam}`}>
              <Icon name="add" size={20} />
              Tambah kategori
            </Link>
          </Button>
        </>
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
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/budget">Muat ulang</Link>
      </Button>
    </div>
  );
}
