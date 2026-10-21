import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { type AccountRow, parseIdrInput } from "@/lib/accounts";
import { currentMonthParam, monthRange } from "@/lib/budgets";

// Re-export the shared IDR parser so transaction forms/actions use the exact
// same unscaled money parsing as accounts (never a duplicate implementation).
export { parseIdrInput };
export type { AccountRow };

// Row shapes straight from the generated DB types so this layer stays in sync
// with the real tables (no hand-maintained duplicates).
export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

// The Supabase server client is created per-request; helpers accept the awaited
// client so callers stay in control of auth/session handling.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// The curated transaction types we offer in the UI. transaction_type is plain
// text in the DB (not an enum), so the DB may hold other values; those still
// render via the fallback in getTransactionTypeMeta.
export const TRANSACTION_TYPES = [
  { value: "income", label: "Pemasukan", icon: ArrowDownLeft },
  { value: "expense", label: "Pengeluaran", icon: ArrowUpRight },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
}>;

export type TransactionType = (typeof TRANSACTION_TYPES)[number]["value"];

export interface TransactionTypeMeta {
  value: string;
  label: string;
  icon: LucideIcon;
}

export function isTransactionType(value: string): value is TransactionType {
  return TRANSACTION_TYPES.some((t) => t.value === value);
}

// Returns the curated entry, or a safe fallback for unknown/legacy values so an
// unexpected transaction_type never crashes the list.
export function getTransactionTypeMeta(value: string): TransactionTypeMeta {
  const match = TRANSACTION_TYPES.find((t) => t.value === value);
  if (match) return match;
  return { value, label: value, icon: ArrowLeftRight };
}

export function formatTransactionTypeLabel(value: string): string {
  return getTransactionTypeMeta(value).label;
}

// Active (non-archived) accounts for the current user, oldest first so the
// transaction form offers them in a stable order.
export async function fetchActiveAccounts(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as AccountRow[];
}

// Categories a user can assign for a given direction: their own plus the shared
// system categories (user_id IS NULL), non-archived, matching the type.
export async function fetchUsableCategories(
  supabase: ServerSupabaseClient,
  userId: string,
  type: "income" | "expense",
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("is_archived", false)
    .eq("category_type", type)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return [];
  return (data ?? []) as CategoryRow[];
}

export interface TransactionFilters {
  q?: string;
  type?: string;
  account?: string;
  category?: string;
  month?: string;
}

// Normalizes raw searchParams values (string | string[] | undefined) into a
// single trimmed string, taking the first entry of an array.
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  if (typeof value === "string") return value.trim();
  return "";
}

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads and normalizes the supported filter keys from the page searchParams.
// Unknown or empty values are ignored; month must be a YYYY-MM string and
// account must be a UUID (lowercased).
export function parseTransactionFilters(
  searchParams: Record<string, string | string[] | undefined>,
): TransactionFilters {
  const filters: TransactionFilters = {};

  const q = firstValue(searchParams.q);
  if (q) filters.q = q;

  const type = firstValue(searchParams.type);
  if (isTransactionType(type)) filters.type = type;

  const account = firstValue(searchParams.account).toLowerCase();
  if (UUID_PATTERN.test(account)) filters.account = account;

  const category = firstValue(searchParams.category);
  if (category) filters.category = category;

  const month = firstValue(searchParams.month);
  if (MONTH_PATTERN.test(month)) filters.month = month;

  return filters;
}

// Builds the user-scoped transactions query from the parsed filters. Returns
// the builder so the caller can await it (and read data/error) itself.
export function buildTransactionListQuery(
  supabase: ServerSupabaseClient,
  userId: string,
  filters: TransactionFilters,
) {
  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId);

  if (filters.q) {
    // Sanitize before interpolating into the PostgREST `.or(...ilike...)`
    // string: escape LIKE wildcards (% _ \) so they are treated literally,
    // and drop characters that have special meaning in PostgREST filter
    // syntax (, ( ) ") which would otherwise break the query string. The
    // user_id .eq above still scopes the result, but this keeps arbitrary
    // search text from producing a malformed query or wrong matches.
    const escaped = filters.q
      .replace(/[\\%_]/g, (c) => `\\${c}`)
      .replace(/[(),"*]/g, " ")
      .trim();
    if (escaped) {
      query = query.or(
        `description.ilike.%${escaped}%,merchant.ilike.%${escaped}%`,
      );
    }
  }

  if (filters.type && isTransactionType(filters.type)) {
    query = query.eq("transaction_type", filters.type);
  }

  if (filters.account && UUID_PATTERN.test(filters.account)) {
    // Validated UUID only (never raw input), so the PostgREST or-string
    // cannot be broken. Matches the source account and the destination of
    // transfers. A second .or() appends another `or=` param, which
    // PostgREST ANDs with the search .or() above.
    query = query.or(
      `account_id.eq.${filters.account},destination_account_id.eq.${filters.account}`,
    );
  }

  if (filters.category) {
    query = query.eq("category_id", filters.category);
  }

  if (filters.month && MONTH_PATTERN.test(filters.month)) {
    const [year, month] = filters.month.split("-").map(Number);
    // Month-bounded range in UTC: [first of month, first of next month).
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 1)).toISOString();
    query = query.gte("transaction_at", start).lt("transaction_at", end);
  }

  // Newest first. transaction_at is often a date-only value (midnight), so
  // many rows on the same day tie; created_at is a unique, monotonic insert
  // time that breaks the tie so the most recently added row sorts on top.
  return query
    .order("transaction_at", { ascending: false })
    .order("created_at", { ascending: false });
}

// Only the columns the income/expense fold needs, from the generated type.
type TransactionDirectionRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "transaction_type" | "amount"
>;

export interface MonthIncomeExpense {
  income: number;
  expense: number;
}

/**
 * Total income and expense for a single user over one month, as
 * `{ income, expense }`.
 *
 * Definition: sum of transactions.amount where user_id = current user and
 * transaction_at in [first of month, first of next month) UTC, folded by
 * transaction_type: income rows add to `income`, expense rows add to
 * `expense`. Transfers (and any unknown/legacy type) are intentionally
 * excluded from both: a transfer moves money between the user's own accounts,
 * so it is neither earnings nor spending for the month.
 *
 * The month window uses monthRange() from lib/budgets, the exact same
 * [start, end) math as buildTransactionListQuery and computeCategorySpending,
 * so the dashboard summary lines up with the ledger month.
 *
 * Security: strictly scoped by the caller-supplied userId (which must come from
 * supabase.auth.getUser(), never client input). Anon/publishable client; RLS
 * stays the backstop.
 *
 * Performance: a SINGLE user-scoped select for the window, folded in one TS
 * pass (no per-type query, no N+1) — mirrors computeAccountBalances /
 * computeCategorySpending.
 *
 * Precision: IDR has no minor units; amounts are unscaled whole rupiah. Each
 * amount is coerced with Number() and a non-finite row is skipped so one bad
 * row cannot poison a total. Throws on query error so the caller can show an
 * incomplete-notice rather than a silently wrong summary.
 */
export async function computeMonthIncomeExpense(
  supabase: ServerSupabaseClient,
  userId: string,
  monthParam: string,
): Promise<MonthIncomeExpense> {
  const { startISO, endISO } = monthRange(monthParam);

  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_type, amount")
    .eq("user_id", userId)
    .gte("transaction_at", startISO)
    .lt("transaction_at", endISO);

  if (error) {
    throw new Error(`Gagal menghitung ringkasan bulan ini: ${error.message}`);
  }

  let income = 0;
  let expense = 0;
  for (const row of (data ?? []) as TransactionDirectionRow[]) {
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;
    if (row.transaction_type === "income") income += amt;
    else if (row.transaction_type === "expense") expense += amt;
  }

  return { income, expense };
}

// The active month the list summarizes: the explicit `month` filter when set,
// otherwise the current local month (matches resolveMonthParam / the dashboard
// default). Additive helper; the filter parsing itself is unchanged.
export function activeMonthFrom(filters: TransactionFilters): string {
  return filters.month ?? currentMonthParam();
}

// Minimal structural shape the day-grouping needs. Keeping it structural (not
// the client TransactionRowView) lets this stay a server-safe lib helper while
// still accepting the fuller row views the page builds.
type GroupableTransaction = Pick<
  TransactionRow,
  "transaction_type" | "amount" | "transaction_at"
>;

export interface TransactionDayGroup<T extends GroupableTransaction> {
  // UTC date-only key, e.g. "2026-10-28".
  key: string;
  // Display label, e.g. "Hari Ini \u00b7 28 Oktober 2026".
  label: string;
  // Per-day net: +income, -expense, transfers net-neutral. Mirrors the
  // income/expense fold in computeMonthIncomeExpense.
  netTotal: number;
  rows: T[];
}

// UTC date-only key for a transaction_at (date-only or ISO timestamp), matching
// the app-wide basis used by the query window, the row date formatter, and
// actions.ts toDateOnly. An unparseable value falls back to its raw string so a
// bad row still groups deterministically rather than crashing.
function dayKeyOf(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

// Long Indonesian date from a "YYYY-MM-DD" key, built on a UTC basis so the
// label never drifts by a zone (same approach as formatMonthLabel).
const dayLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function longDateFromKey(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return dayLabelFormatter.format(date);
}

// Groups already-ordered rows (newest first) into per-day sections, preserving
// the query order: insertion order gives newest day first, and rows inside a
// day stay in their newest-first order. Per-day net folds income (+), expense
// (-), and leaves transfers/unknown net-neutral (a transfer moves money between
// the user's own accounts). "Hari Ini"/"Kemarin" are prefixed when the day key
// matches today/yesterday on the same UTC date-only basis.
export function groupTransactionsByDay<T extends GroupableTransaction>(
  rows: T[],
): TransactionDayGroup<T>[] {
  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const groups: TransactionDayGroup<T>[] = [];
  const byKey = new Map<string, TransactionDayGroup<T>>();

  for (const row of rows) {
    const key = dayKeyOf(row.transaction_at);
    let group = byKey.get(key);
    if (!group) {
      const longDate = longDateFromKey(key);
      const label =
        key === todayKey
          ? `Hari Ini \u00b7 ${longDate}`
          : key === yesterdayKey
            ? `Kemarin \u00b7 ${longDate}`
            : longDate;
      group = { key, label, netTotal: 0, rows: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    const amt = Number(row.amount);
    if (Number.isFinite(amt)) {
      if (row.transaction_type === "income") group.netTotal += amt;
      else if (row.transaction_type === "expense") group.netTotal -= amt;
    }
    group.rows.push(row);
  }

  return groups;
}
