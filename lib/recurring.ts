import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { type AccountRow, parseIdrInput } from "@/lib/accounts";
import {
  TRANSACTION_TYPES,
  getTransactionTypeMeta,
  isTransactionType,
  fetchActiveAccounts,
  fetchUsableCategories,
  type CategoryRow,
} from "@/lib/transactions";

// Re-export the shared helpers so the recurring form/actions use the exact same
// money parsing, type metadata, and fetchers as transactions (one source).
export { parseIdrInput };
export {
  TRANSACTION_TYPES,
  getTransactionTypeMeta,
  isTransactionType,
  fetchActiveAccounts,
  fetchUsableCategories,
};
export type { AccountRow, CategoryRow };

// Row shape straight from the generated DB types so this layer stays in sync
// with the real table (no hand-maintained duplicate).
export type RecurringRow =
  Database["public"]["Tables"]["recurring_transactions"]["Row"];

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// The curated frequency set we offer in the UI. frequency is plain text in the
// DB (not an enum), so the DB may hold other values; those still render via the
// fallback in getFrequencyMeta.
export const FREQUENCIES = [
  { value: "daily", label: "Setiap hari", unit: "hari" },
  { value: "weekly", label: "Setiap minggu", unit: "minggu" },
  { value: "monthly", label: "Setiap bulan", unit: "bulan" },
  { value: "yearly", label: "Setiap tahun", unit: "tahun" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  unit: string;
}>;

export type Frequency = (typeof FREQUENCIES)[number]["value"];

export interface FrequencyMeta {
  value: string;
  label: string;
  unit: string;
}

export function isFrequency(value: string): value is Frequency {
  return FREQUENCIES.some((f) => f.value === value);
}

// Returns the curated entry, or a safe fallback for unknown/legacy values so an
// unexpected frequency never crashes the list.
export function getFrequencyMeta(value: string): FrequencyMeta {
  const match = FREQUENCIES.find((f) => f.value === value);
  if (match) return match;
  return { value, label: value, unit: value };
}

// Human label combining frequency + interval. interval === 1 → the base label
// (e.g. "Setiap bulan"); interval > 1 → "Setiap {n} {unit}" (e.g.
// "Setiap 2 minggu"). Indonesian has no plural suffix so the unit is unchanged.
export function formatFrequency(frequency: string, interval: number): string {
  const meta = getFrequencyMeta(frequency);
  const safeInterval =
    Number.isFinite(interval) && interval >= 1 ? Math.floor(interval) : 1;
  if (safeInterval === 1) return meta.label;
  return `Setiap ${safeInterval} ${meta.unit}`;
}

// Days in a given month (month is 0-indexed). Day 0 of the next month is the
// last day of the target month.
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Adds whole months to a UTC date with a month-end clamp: the target day is
// min(originalDay, daysInTargetMonth) so e.g. Jan 31 + 1 month → Feb 28/29
// instead of JS Date's silent roll into March.
function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const day = date.getUTCDate();

  const totalMonths = monthIndex + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;

  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonthIndex));
  return new Date(Date.UTC(targetYear, targetMonthIndex, clampedDay));
}

// Matches a canonical "YYYY-MM-DD" and confirms it is a real calendar date.
function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  // Reject overflow like 2026-13-40 (JS would roll it forward silently).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function toDateOnlyString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * PURE helper: the next due date after `from`, as a "YYYY-MM-DD" string.
 *
 * Date-only math in UTC avoids DST/timezone drift. daily adds `interval` days;
 * weekly adds `interval * 7` days; monthly adds `interval` months with a
 * month-end clamp (Jan 31 + 1mo → Feb 28/29); yearly adds `interval` years with
 * the same clamp (Feb 29 → Feb 28 on a non-leap year).
 *
 * Guards: an invalid date, an unknown frequency, or interval < 1 returns the
 * input unchanged so a Server Action never throws on bad input.
 */
export function computeNextDueDate(
  frequency: string,
  interval: number,
  from: string,
): string {
  const base = parseDateOnly(from);
  if (!base) return from;

  if (!Number.isFinite(interval) || interval < 1) return from;
  const step = Math.floor(interval);

  switch (frequency) {
    case "daily": {
      const next = new Date(base);
      next.setUTCDate(next.getUTCDate() + step);
      return toDateOnlyString(next);
    }
    case "weekly": {
      const next = new Date(base);
      next.setUTCDate(next.getUTCDate() + step * 7);
      return toDateOnlyString(next);
    }
    case "monthly":
      return toDateOnlyString(addMonthsClamped(base, step));
    case "yearly":
      return toDateOnlyString(addMonthsClamped(base, step * 12));
    default:
      // Unknown frequency: do not guess a cadence.
      return from;
  }
}

const recurringDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Date-only display (e.g. "4 Mar 2025") for the next-due line. Parses a plain
// YYYY-MM-DD as a UTC date so the day never shifts across the local timezone.
export function formatRecurringDate(value: string | null): string {
  if (!value) return "";
  const date = parseDateOnly(value);
  if (!date) {
    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) return value;
    return recurringDateFormatter.format(fallback);
  }
  return recurringDateFormatter.format(date);
}

// All recurring templates for the user in one query. Active first, then by the
// soonest due date so the most actionable template sorts to the top of each
// group (the list splits active vs paused in the page).
export async function fetchRecurringTemplates(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<RecurringRow[]> {
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("next_due_date", { ascending: true });

  if (error) throw new Error(`Gagal memuat transaksi berulang: ${error.message}`);
  return (data ?? []) as RecurringRow[];
}
