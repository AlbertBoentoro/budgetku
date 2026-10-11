import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { parseIdrInput } from "@/lib/accounts";

// Re-export the shared IDR parser so budget forms/actions use the exact same
// unscaled money parsing as accounts/transactions (never a duplicate).
export { parseIdrInput };

// Row shapes straight from the generated DB types so this layer stays in sync
// with the real tables (no hand-maintained duplicates).
export type BudgetRow = Database["public"]["Tables"]["budgets"]["Row"];
export type BudgetItemRow = Database["public"]["Tables"]["budget_items"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

// The Supabase server client is created per-request; helpers accept the awaited
// client so callers stay in control of auth/session handling.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Only the columns the spending aggregation needs, from the generated type.
type TransactionSpendRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "category_id" | "amount"
>;

// UI/URL month form, e.g. "2026-10" (matches the existing type="month" input
// and the MONTH_PATTERN used in lib/transactions.ts).
export const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;

export function isMonthParam(value: string): boolean {
  return MONTH_PARAM_PATTERN.test(value);
}

// "2026-10" (UI) -> "2026-10-01" (DB canonical).
export function toMonthStorage(monthParam: string): string {
  return `${monthParam}-01`;
}

// "2026-10-01" (DB canonical) -> "2026-10". Accepts any leading "YYYY-MM".
export function toMonthParam(monthStorage: string): string {
  return monthStorage.slice(0, 7);
}

// Current month as "YYYY-MM" in local time (default when no ?month given).
export function currentMonthParam(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Takes the first entry of an array searchParam, trimmed.
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  if (typeof value === "string") return value.trim();
  return "";
}

// Normalize searchParams -> a valid "YYYY-MM"; fall back to current month.
export function resolveMonthParam(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const month = firstValue(searchParams.month);
  return isMonthParam(month) ? month : currentMonthParam();
}

// Indonesian display, e.g. "Oktober 2026". Built from the UTC first-of-month so
// the label never drifts by a day across time zones.
const monthLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonthLabel(monthParam: string): string {
  if (!isMonthParam(monthParam)) return monthParam;
  const [year, month] = monthParam.split("-").map(Number);
  return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

// Prev/next "YYYY-MM" for the switcher. delta is in whole months.
export function shiftMonthParam(monthParam: string, delta: number): string {
  const [year, month] = monthParam.split("-").map(Number);
  // Date.UTC normalizes month overflow/underflow (e.g. month 13 -> next year).
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// [startISO, endISO) UTC window for a "YYYY-MM", matching the exact approach in
// buildTransactionListQuery so budget spending lines up with the ledger month.
export function monthRange(monthParam: string): {
  startISO: string;
  endISO: string;
} {
  const [year, month] = monthParam.split("-").map(Number);
  const startISO = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const endISO = new Date(Date.UTC(year, month, 1)).toISOString();
  return { startISO, endISO };
}

// At most one budget per (user, month). month is passed in storage form.
export async function fetchBudgetForMonth(
  supabase: ServerSupabaseClient,
  userId: string,
  monthStorage: string,
): Promise<BudgetRow | null> {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("month", monthStorage)
    .maybeSingle();

  if (error) return null;
  return (data as BudgetRow | null) ?? null;
}

// Items for a budget, oldest first so the list order is stable as items are
// added (mirrors fetchActiveAccounts ordering).
export async function fetchBudgetItems(
  supabase: ServerSupabaseClient,
  userId: string,
  budgetId: string,
): Promise<BudgetItemRow[]> {
  const { data, error } = await supabase
    .from("budget_items")
    .select("*")
    .eq("user_id", userId)
    .eq("budget_id", budgetId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as BudgetItemRow[];
}

// Expense categories usable by the user (own or shared system), non-archived,
// for the budget-item category select. Mirrors fetchUsableCategories.
export async function fetchExpenseCategories(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("is_archived", false)
    .eq("category_type", "expense")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return [];
  return (data ?? []) as CategoryRow[];
}

/**
 * Per-category expense spending for the budget's month, as a Map of
 * category id -> summed amount.
 *
 * Definition: sum of transactions.amount where user_id = current user,
 * transaction_type = 'expense', transaction_at in [first of month, first of
 * next month) UTC, and (when ids are given) category_id in those ids. Income
 * and transfers are intentionally excluded: they never count against an
 * expense budget.
 *
 * Security: strictly scoped by the caller-supplied userId (which must come from
 * supabase.auth.getUser(), never client input). Anon/publishable client; RLS
 * stays the backstop.
 *
 * Performance: a SINGLE user-scoped select for the window, folded in one TS
 * pass into the Map (no per-category query, no N+1, no RPC/view) — mirrors
 * computeAccountBalances.
 *
 * Precision: IDR has no minor units; amounts are unscaled whole rupiah. Each
 * amount is coerced with Number() and a non-finite row is skipped so one bad
 * row cannot poison a category total. Throws on query error so the caller can
 * show an incomplete-notice rather than a silently wrong budget.
 */
export async function computeCategorySpending(
  supabase: ServerSupabaseClient,
  userId: string,
  monthParam: string,
  categoryIds?: string[],
): Promise<Map<string, number>> {
  // An explicit empty id list means there is nothing to sum; skip the query.
  if (categoryIds && categoryIds.length === 0) {
    return new Map<string, number>();
  }

  const { startISO, endISO } = monthRange(monthParam);

  let query = supabase
    .from("transactions")
    .select("category_id, amount")
    .eq("user_id", userId)
    .eq("transaction_type", "expense")
    .gte("transaction_at", startISO)
    .lt("transaction_at", endISO);

  if (categoryIds && categoryIds.length > 0) {
    query = query.in("category_id", categoryIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal menghitung pemakaian anggaran: ${error.message}`);
  }

  const spending = new Map<string, number>();
  for (const row of (data ?? []) as TransactionSpendRow[]) {
    if (!row.category_id) continue;
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;
    spending.set(row.category_id, (spending.get(row.category_id) ?? 0) + amt);
  }

  return spending;
}

// Pure usage math for one item (no rounding/scaling of the stored IDR values).
export interface BudgetItemUsage {
  planned: number;
  spent: number;
  remaining: number; // planned - spent (may be negative when over budget)
  ratio: number; // spent/planned, 0 when planned <= 0
  isOverBudget: boolean; // spent > planned
  barPercent: number; // clamp(ratio*100, 0, 100) — bar width only
}

export function computeItemUsage(
  planned: number,
  spent: number,
): BudgetItemUsage {
  const safePlanned = Number.isFinite(planned) ? planned : 0;
  const safeSpent = Number.isFinite(spent) ? spent : 0;
  const remaining = safePlanned - safeSpent;
  const ratio = safePlanned > 0 ? safeSpent / safePlanned : 0;
  const barPercent = Math.max(0, Math.min(100, ratio * 100));
  return {
    planned: safePlanned,
    spent: safeSpent,
    remaining,
    ratio,
    isOverBudget: safeSpent > safePlanned,
    barPercent,
  };
}

// View type the row component consumes: a budget item plus its resolved
// category name and computed usage.
export interface BudgetItemView extends BudgetItemRow {
  categoryName: string | null;
  usage: BudgetItemUsage;
}

// Budget-level totals folded across all item views.
export interface BudgetTotals {
  planned: number;
  spent: number;
  remaining: number;
  isOverBudget: boolean;
}

export function computeBudgetTotals(items: BudgetItemView[]): BudgetTotals {
  let planned = 0;
  let spent = 0;
  for (const item of items) {
    planned += item.usage.planned;
    spent += item.usage.spent;
  }
  const remaining = planned - spent;
  return { planned, spent, remaining, isOverBudget: spent > planned };
}
