import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { monthRange } from "@/lib/budgets";
import type { TransactionFilters } from "@/lib/transactions";
import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
export type AccountBalanceAdjustmentRow =
  Database["public"]["Tables"]["account_balance_adjustments"]["Row"];

// Read-only entry in the Transactions ledger. It is not an income/expense
// transaction and never contributes to balances, budgets or reporting.
export interface BalanceAdjustmentRowView {
  kind: "balance_adjustment";
  id: string;
  transaction_type: "balance_adjustment";
  transaction_at: string;
  amount: number;
  accountName: string;
  account_id: string;
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
}

export function adjustmentMatchesFilter(
  row: Pick<AccountBalanceAdjustmentRow, "account_name">,
  filters: TransactionFilters,
): boolean {
  if (filters.type || filters.category) return false;
  const query = filters.q?.trim().toLocaleLowerCase("id-ID");
  if (!query) return true;
  return row.account_name.toLocaleLowerCase("id-ID").includes(query) ||
    "penyesuaian saldo".includes(query);
}

export function toAdjustmentView(row: AccountBalanceAdjustmentRow): BalanceAdjustmentRowView {
  return {
    kind: "balance_adjustment",
    id: `balance-adjustment-${row.id}`,
    transaction_type: "balance_adjustment",
    transaction_at: row.created_at,
    amount: Math.abs(Number(row.delta)),
    accountName: row.account_name,
    account_id: row.account_id,
    balanceBefore: Number(row.balance_before),
    balanceAfter: Number(row.balance_after),
    delta: Number(row.delta),
  };
}

export async function fetchBalanceAdjustments(
  supabase: ServerSupabaseClient,
  userId: string,
  filters: TransactionFilters,
): Promise<BalanceAdjustmentRowView[]> {
  if (filters.type || filters.category) return [];
  const rows = await fetchAllPages((from, to) => {
    let query = supabase.from("account_balance_adjustments")
      .select("*")
      .eq("user_id", userId);

    if (filters.account) query = query.eq("account_id", filters.account);
    if (filters.month) {
      const { startISO, endISO } = monthRange(filters.month);
      query = query.gte("created_at", startISO).lt("created_at", endISO);
    }
    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
  });
  return (rows as AccountBalanceAdjustmentRow[])
    .filter((row) => adjustmentMatchesFilter(row, filters))
    .map(toAdjustmentView);
}
