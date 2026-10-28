import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  computeCategorySpending,
  computeItemUsage,
  fetchBudgetForMonth,
  fetchBudgetItems,
  formatMonthLabel,
  resolveMonthParam,
  toMonthStorage,
  type BudgetItemView,
  type CategoryRow,
} from "@/lib/budgets";
import { computeMonthIncomeExpense } from "@/lib/transactions";
import {
  computeExpenseByCategory,
  computeMonthlyTrend,
  UNCATEGORIZED_KEY,
  type MonthlyTrendPoint,
} from "@/lib/reports";
import { AppBackLink } from "@/components/layout/app-back-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { BudgetMonthSwitcher } from "@/components/finance/budget-month-switcher";
import {
  BudgetVsActualList,
  type BudgetVsActualRow,
} from "@/components/finance/budget-vs-actual-list";
import {
  CategoryBreakdownChart,
  type CategoryBreakdownDatum,
} from "@/components/charts/category-breakdown-chart";
import { MonthlyTrendChart } from "@/components/charts/monthly-trend-chart";
import { ReportSummaryCard } from "@/components/reports/report-summary-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  ReportsLoading,
} from "@/app/(app)/reports/loading";

type SearchParams = Record<string, string | string[] | undefined>;

// How many months the trend covers, ending at the selected month.
const TREND_MONTHS = 6;

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <AppHeader
        title="Laporan"
        titleAction={
          <AppBackLink href="/settings" label="Kembali ke Pengaturan" />
        }
      />
      <PageContainer>
        <Suspense fallback={<ReportsLoading />}>
          <ReportsContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function ReportsContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Request-time work: the current-month fallback and the Supabase client both
  // read the clock, which partialPrefetching rejects before connection().
  await connection();

  const resolvedSearchParams = await searchParams;
  const monthParam = resolveMonthParam(resolvedSearchParams);
  const monthLabel = formatMonthLabel(monthParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // every query strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return (
      <ReportsError message="Sesi berakhir. Silakan masuk kembali untuk melihat laporan." />
    );
  }

  // --- (a) Top-line summary (income / expense / net) for the month. ---
  let income = 0;
  let expense = 0;
  let summaryIncomplete = false;
  try {
    const summary = await computeMonthIncomeExpense(supabase, user.id, monthParam);
    income = summary.income;
    expense = summary.expense;
  } catch {
    summaryIncomplete = true;
  }
  const net = income - expense;

  // --- (b) Spending breakdown by category (expense only). ---
  let categoryData: CategoryBreakdownDatum[] = [];
  let categoryIncomplete = false;
  try {
    const byCategory = await computeExpenseByCategory(
      supabase,
      user.id,
      monthParam,
    );

    // Resolve names for the real category ids in one scoped lookup (own +
    // system categories), mirroring dashboard/budget. The uncategorized bucket
    // gets an honest label instead of being dropped.
    const realIds = Array.from(byCategory.keys()).filter(
      (id) => id !== UNCATEGORIZED_KEY,
    );
    const nameById = new Map<string, string>();
    if (realIds.length > 0) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", realIds)
        .or(`user_id.eq.${user.id},user_id.is.null`);
      for (const c of (cats ?? []) as Pick<CategoryRow, "id" | "name">[]) {
        nameById.set(c.id, c.name);
      }
    }

    const totalExpense = Array.from(byCategory.values()).reduce(
      (sum, v) => sum + v,
      0,
    );

    // Largest first so the most significant spend reads at the top.
    const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
    categoryData = sorted.map(([key, amount], index) => ({
      name:
        key === UNCATEGORIZED_KEY
          ? "Tanpa kategori"
          : nameById.get(key) ?? "Kategori lain",
      amount,
      percent: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      colorIndex: index,
    }));
  } catch {
    categoryIncomplete = true;
  }

  // --- (c) Monthly trend (income vs expense, last N months). ---
  let trend: MonthlyTrendPoint[] = [];
  let trendIncomplete = false;
  try {
    trend = await computeMonthlyTrend(supabase, user.id, monthParam, TREND_MONTHS);
  } catch {
    trendIncomplete = true;
  }
  const trendHasData = trend.some((p) => p.income > 0 || p.expense > 0);

  // --- (d) Budget vs actual for the selected month (if a budget exists). ---
  let budgetRows: BudgetVsActualRow[] = [];
  let budgetExists = false;
  let budgetIncomplete = false;
  try {
    const budget = await fetchBudgetForMonth(
      supabase,
      user.id,
      toMonthStorage(monthParam),
    );
    if (budget) {
      budgetExists = true;
      const items = await fetchBudgetItems(supabase, user.id, budget.id);

      // De-duplicate by category_id (first wins), same as the budget page.
      const seen = new Set<string>();
      const uniqueItems = items.filter((item) => {
        if (seen.has(item.category_id)) return false;
        seen.add(item.category_id);
        return true;
      });

      const categoryIds = uniqueItems.map((item) => item.category_id);
      const nameById = new Map<string, string>();
      if (categoryIds.length > 0) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id, name")
          .in("id", categoryIds);
        for (const c of (cats ?? []) as Pick<CategoryRow, "id" | "name">[]) {
          nameById.set(c.id, c.name);
        }
      }

      const spending = await computeCategorySpending(
        supabase,
        user.id,
        monthParam,
        categoryIds,
      );

      const views: BudgetItemView[] = uniqueItems.map((item) => {
        const planned = Number(item.planned_amount);
        const spent = spending.get(item.category_id) ?? 0;
        return {
          ...item,
          categoryName: nameById.get(item.category_id) ?? null,
          usage: computeItemUsage(planned, spent),
        };
      });

      budgetRows = views.map((view) => ({
        categoryName: view.categoryName ?? "Kategori",
        planned: view.usage.planned,
        spent: view.usage.spent,
        remaining: view.usage.remaining,
        isOverBudget: view.usage.isOverBudget,
        barPercent: view.usage.barPercent,
      }));
    }
  } catch {
    budgetIncomplete = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <BudgetMonthSwitcher monthParam={monthParam} />

      {/* (a) Top-line summary: the month's Selisih is the focal figure. */}
      <ReportSummaryCard
        monthLabel={monthLabel}
        income={income}
        expense={expense}
        net={net}
        incomplete={summaryIncomplete}
      />

      {/* (b) Spending by category */}
      <ReportSection title="Pengeluaran per kategori" caption={monthLabel}>
        {categoryIncomplete ? (
          <SectionNotice>
            Rincian kategori belum bisa dimuat. Coba muat ulang.
          </SectionNotice>
        ) : categoryData.length === 0 ? (
          <ReportEmptyState
            glyph="pie_chart"
            title="Belum ada pengeluaran untuk periode ini"
            description="Catat pengeluaran bulan ini untuk melihat rinciannya di sini."
          />
        ) : (
          <CategoryBreakdownChart data={categoryData} />
        )}
      </ReportSection>

      {/* (c) Monthly trend */}
      <ReportSection
        title="Tren pemasukan vs pengeluaran"
        caption={`${TREND_MONTHS} bulan terakhir`}
      >
        {trendIncomplete ? (
          <SectionNotice>Tren belum bisa dimuat. Coba muat ulang.</SectionNotice>
        ) : !trendHasData ? (
          <ReportEmptyState
            glyph="bar_chart"
            title="Belum ada data untuk periode ini"
            description="Tren akan muncul setelah ada pemasukan atau pengeluaran dalam enam bulan terakhir."
          />
        ) : (
          <MonthlyTrendChart data={trend} />
        )}
      </ReportSection>

      {/* (d) Budget vs actual. The list is its own card, so the section skips
          the wrapper only when rows are shown. */}
      <ReportSection
        title="Anggaran vs realisasi"
        caption={monthLabel}
        bare={!budgetIncomplete && budgetExists && budgetRows.length > 0}
      >
        {budgetIncomplete ? (
          <SectionNotice>
            Perbandingan anggaran belum bisa dimuat. Coba muat ulang.
          </SectionNotice>
        ) : !budgetExists ? (
          <ReportEmptyState
            glyph="savings"
            title="Belum ada anggaran untuk bulan ini"
            description="Buat anggaran untuk membandingkan rencana dengan realisasi pengeluaran."
            action={
              <Button asChild className="h-11">
                <Link href={`/budget?month=${monthParam}`}>Buka anggaran</Link>
              </Button>
            }
          />
        ) : budgetRows.length === 0 ? (
          <ReportEmptyState
            glyph="category"
            title="Belum ada batas kategori"
            description="Tambahkan batas pengeluaran pada anggaran untuk melihat perbandingannya."
          />
        ) : (
          <BudgetVsActualList rows={budgetRows} />
        )}
      </ReportSection>
    </div>
  );
}

// Section title + caption above a white Calm Ledger card. `bare` skips the
// card when the child already renders as one (the budget list).
function ReportSection({
  title,
  caption,
  bare = false,
  children,
}: {
  title: string;
  caption?: string;
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        {caption ? (
          <p className="text-body-sm text-on-surface-variant">{caption}</p>
        ) : null}
      </div>
      {bare ? (
        children
      ) : (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
          {children}
        </div>
      )}
    </section>
  );
}

// Quiet per-section notice when that section's query failed; other sections
// still render.
function SectionNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-body-sm text-on-surface-variant">
      {children}
    </p>
  );
}

// Stitch empty state (Material Symbols, Calm Ledger tokens), same shape as
// LedgerEmptyState on Transaksi. Kept local so the shared lucide-based
// EmptyState API stays untouched for other callers.
function ReportEmptyState({
  glyph,
  title,
  description,
  action,
}: {
  glyph: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={glyph} size={24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-title-md font-medium text-on-surface">{title}</p>
        <p className="max-w-xs text-body-sm text-on-surface-variant">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function ReportsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">{message}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/reports">Muat ulang</Link>
      </Button>
    </div>
  );
}
