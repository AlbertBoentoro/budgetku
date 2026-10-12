import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { monthRange, shiftMonthParam } from "@/lib/budgets";

// The Supabase server client is created per-request; helpers accept the awaited
// client so callers stay in control of auth/session handling.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Sentinel key for expense rows with no category_id, so uncategorized spend is
// shown honestly rather than silently dropped. Not a real category id.
export const UNCATEGORIZED_KEY = "__uncategorized__";

// Only the columns the category fold needs, from the generated type.
type ExpenseCategoryRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "category_id" | "amount"
>;

// Only the columns the trend fold needs, from the generated type.
type TrendRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "transaction_at" | "transaction_type" | "amount"
>;

// One point of the monthly income-vs-expense trend. All fields are plain
// strings/numbers so the page can pass them straight to a client chart.
export interface MonthlyTrendPoint {
  // Canonical "YYYY-MM" bucket key.
  month: string;
  // Indonesian short month label for the axis, e.g. "Okt".
  label: string;
  income: number;
  expense: number;
}

// Indonesian short month, built from the UTC first-of-month so the label never
// drifts by a day across time zones (same approach as formatMonthLabel).
const shortMonthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  timeZone: "UTC",
});

function shortMonthLabel(monthParam: string): string {
  const [year, month] = monthParam.split("-").map(Number);
  return shortMonthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Per-category expense totals for a single user over one month, as a Map of
 * category id -> summed amount. Expense rows with no category_id are summed
 * under UNCATEGORIZED_KEY.
 *
 * Definition: sum of transactions.amount where user_id = current user,
 * transaction_type = 'expense', and transaction_at in [first of month, first
 * of next month) UTC. Income and transfers are intentionally excluded: this
 * answers "where did my expense money go this month?".
 *
 * This is a sibling of computeCategorySpending in lib/budgets (same window math
 * via monthRange, same single-query fold), but it keeps uncategorized spend and
 * never filters by a category id list.
 *
 * Security: strictly scoped by the caller-supplied userId (which must come from
 * supabase.auth.getUser(), never client input). Anon/publishable client; RLS
 * stays the backstop.
 *
 * Precision: IDR has no minor units; amounts are unscaled whole rupiah. Each
 * amount is coerced with Number() and a non-finite row is skipped so one bad
 * row cannot poison a total. Throws on query error so the caller can show an
 * incomplete-notice rather than a silently wrong breakdown.
 */
export async function computeExpenseByCategory(
  supabase: ServerSupabaseClient,
  userId: string,
  monthParam: string,
): Promise<Map<string, number>> {
  const { startISO, endISO } = monthRange(monthParam);

  const { data, error } = await supabase
    .from("transactions")
    .select("category_id, amount")
    .eq("user_id", userId)
    .eq("transaction_type", "expense")
    .gte("transaction_at", startISO)
    .lt("transaction_at", endISO);

  if (error) {
    throw new Error(`Gagal menghitung pengeluaran per kategori: ${error.message}`);
  }

  const byCategory = new Map<string, number>();
  for (const row of (data ?? []) as ExpenseCategoryRow[]) {
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;
    const key = row.category_id ?? UNCATEGORIZED_KEY;
    byCategory.set(key, (byCategory.get(key) ?? 0) + amt);
  }

  return byCategory;
}

/**
 * Income vs expense for a single user over the last `months` months ending at
 * (and including) monthParam, oldest first.
 *
 * Definition: one query over the full span
 * [monthRange(oldest).startISO, monthRange(monthParam).endISO), bucketed by the
 * row's "YYYY-MM" (derived from transaction_at), summing income into `income`
 * and expense into `expense`. Transfers (and any unknown type) are excluded,
 * matching computeMonthIncomeExpense. Months with no rows return zeros so the
 * trend is honest (a gap is a real zero, not a missing bar).
 *
 * The month windows reuse monthRange + shiftMonthParam from lib/budgets so the
 * buckets line up exactly with the ledger month used everywhere else.
 *
 * Security/precision: same contract as computeExpenseByCategory above.
 */
export async function computeMonthlyTrend(
  supabase: ServerSupabaseClient,
  userId: string,
  monthParam: string,
  months = 6,
): Promise<MonthlyTrendPoint[]> {
  const span = Math.max(1, Math.floor(months));

  // Oldest included month is (span - 1) months before the selected month.
  const oldestParam = shiftMonthParam(monthParam, -(span - 1));
  const startISO = monthRange(oldestParam).startISO;
  const endISO = monthRange(monthParam).endISO;

  // Pre-seed the buckets oldest -> newest so a month with no rows is a real zero
  // rather than an omitted point.
  const points: MonthlyTrendPoint[] = [];
  const indexByMonth = new Map<string, number>();
  for (let i = 0; i < span; i++) {
    const m = shiftMonthParam(oldestParam, i);
    indexByMonth.set(m, points.length);
    points.push({ month: m, label: shortMonthLabel(m), income: 0, expense: 0 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_at, transaction_type, amount")
    .eq("user_id", userId)
    .gte("transaction_at", startISO)
    .lt("transaction_at", endISO);

  if (error) {
    throw new Error(`Gagal menghitung tren bulanan: ${error.message}`);
  }

  for (const row of (data ?? []) as TrendRow[]) {
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;
    // transaction_at is an ISO/date string; its leading "YYYY-MM" is the bucket.
    const key = row.transaction_at.slice(0, 7);
    const index = indexByMonth.get(key);
    if (index === undefined) continue;
    if (row.transaction_type === "income") points[index].income += amt;
    else if (row.transaction_type === "expense") points[index].expense += amt;
  }

  return points;
}
