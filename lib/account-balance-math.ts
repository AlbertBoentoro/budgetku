/**
 * Pure, deterministic finance calculations used by account screens.
 * No database or browser dependency: can be regression-tested with synthetic
 * transactions and never needs access to a user's real financial data.
 */
export type TransactionBalanceEffect = {
  account_id: string;
  destination_account_id: string | null;
  amount: number;
  transaction_type: string;
};

export type IncludedAccount = {
  id: string;
  initial_balance: number;
  include_in_total: boolean;
};

export function computeTransactionEffects(
  rows: readonly TransactionBalanceEffect[],
): Map<string, number> {
  const net = new Map<string, number>();
  const add = (accountId: string | null, delta: number) => {
    if (!accountId) return;
    net.set(accountId, (net.get(accountId) ?? 0) + delta);
  };
  for (const row of rows) {
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
      default:
        break;
    }
  }
  return net;
}

export function sumRunningAccountBalances(
  accounts: readonly IncludedAccount[],
  balances: ReadonlyMap<string, number>,
): number {
  let total = 0;
  for (const account of accounts) {
    if (!account.include_in_total) continue;
    const balance = balances.get(account.id) ?? account.initial_balance;
    if (Number.isFinite(balance)) total += balance;
  }
  return total;
}
