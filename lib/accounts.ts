import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Row shape straight from the generated DB types so the UI stays in sync with
// the actual accounts table (no hand-maintained duplicate).
export type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];

// The Supabase server client is created per-request; the balance helper accepts
// the awaited client so the caller keeps control of auth/session handling
// (mirrors the pattern in lib/transactions.ts).
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Only the columns the running-balance math needs, straight from the generated
// transactions Row type (no hand-maintained duplicate).
type TransactionBalanceRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "account_id" | "destination_account_id" | "amount" | "transaction_type"
>;

/**
 * Net transaction effect per account for a single user, as a Map of
 * account id -> signed net amount (NOT including initial_balance; the caller
 * composes `initial_balance + net` so it can degrade to initial_balance on
 * failure).
 *
 * Sign model (unchanged from storage): `amount` is always a positive magnitude
 * and `transaction_type` decides direction.
 *   - income  on account_id: +amount
 *   - expense on account_id: -amount
 *   - transfer: -amount from account_id (source) and +amount to
 *     destination_account_id (target)
 * ALL transactions are counted regardless of transaction_at (no date cutoff).
 *
 * Security: strictly scoped by the caller-supplied userId (which must come from
 * supabase.auth.getUser(), never client input). Uses the request's anon/
 * publishable client; RLS stays the backstop. Throws on query error so the
 * caller can fall back to initial_balance rather than show a wrong number.
 *
 * Performance: one user-scoped select, folded in a single pass in TypeScript.
 * No per-account query (no N+1), no DB object/RPC.
 *
 * Precision: IDR here has no minor units; values are unscaled whole rupiah.
 * Each amount is coerced with Number() and a non-finite result skips only that
 * row's contribution, so one bad row cannot poison a whole balance. No rounding
 * or scaling is done; AmountText formats with maximumFractionDigits: 0.
 */
export async function computeAccountBalances(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("account_id, destination_account_id, amount, transaction_type")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Gagal menghitung saldo rekening: ${error.message}`);
  }

  const net = new Map<string, number>();
  const add = (accountId: string | null, delta: number) => {
    if (!accountId) return;
    net.set(accountId, (net.get(accountId) ?? 0) + delta);
  };

  for (const row of (data ?? []) as TransactionBalanceRow[]) {
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;

    switch (row.transaction_type) {
      case "income":
        add(row.account_id, amt);
        break;
      case "expense":
        add(row.account_id, -amt);
        break;
      case "transfer":
        add(row.account_id, -amt);
        add(row.destination_account_id, amt);
        break;
      // Unknown/legacy types contribute nothing rather than guessing a sign.
      default:
        break;
    }
  }

  return net;
}

export function sumRunningAccountBalances(
  accounts: readonly Pick<AccountRow, "id" | "initial_balance">[],
  balances: ReadonlyMap<string, number>,
): number {
  // All accounts contribute; this intentionally ignores the legacy toggle.
  let total = 0;
  for (const account of accounts) {
    const balance = balances.get(account.id) ?? account.initial_balance;
    if (Number.isFinite(balance)) total += balance;
  }
  return total;
}

// Muted account accent tokens that already exist in tailwind.config.ts
// (text-account-*). Account icons are the ONLY place these colors appear.
export type AccountAccent =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "slate";

// The curated set of account types we offer in the UI. account_type is plain
// text in the DB (not an enum), so the DB may hold other/legacy values; those
// still render via the fallback in getAccountTypeMeta.
export const ACCOUNT_TYPES = [
  { value: "cash", label: "Tunai", icon: Banknote, accent: "amber" },
  { value: "bank", label: "Rekening bank", icon: Landmark, accent: "blue" },
  { value: "e_wallet", label: "E-wallet", icon: Wallet, accent: "violet" },
  {
    value: "credit_card",
    label: "Kartu kredit",
    icon: CreditCard,
    accent: "rose",
  },
  { value: "savings", label: "Tabungan", icon: PiggyBank, accent: "emerald" },
  {
    value: "investment",
    label: "Investasi",
    icon: TrendingUp,
    accent: "slate",
  },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
  accent: AccountAccent;
}>;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

export interface AccountTypeMeta {
  value: string;
  label: string;
  icon: LucideIcon;
  accent: AccountAccent;
}

export function isAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPES.some((t) => t.value === value);
}

// Returns the curated entry, or a safe fallback for unknown/legacy values so
// an unexpected account_type never crashes the list.
export function getAccountTypeMeta(value: string): AccountTypeMeta {
  const match = ACCOUNT_TYPES.find((t) => t.value === value);
  if (match) return match;
  return { value, label: value, icon: Wallet, accent: "slate" };
}

export function formatAccountTypeLabel(value: string): string {
  return getAccountTypeMeta(value).label;
}

// Parses a user-typed IDR amount (may contain "." thousands separators,
// spaces, or a leading "Rp") into a finite, non-negative number, or null if
// it is not a valid amount. The parsed number is stored unscaled.
export function parseIdrInput(raw: string): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/rp/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
