import { isValidIdrAmount } from "./idr-money.ts";

// All balance adjustments are done in integer sen to avoid floating-point
// drift when the ledger contains fractional Rupiah.
function centsOf(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Math.abs(value * 100 - cents) < 0.000001
    ? cents : null;
}

export function runningBalanceFromOpening(
  initialBalance: number,
  transactionNet: number,
): number | null {
  const opening = centsOf(initialBalance);
  const net = centsOf(transactionNet);
  if (opening === null || net === null) return null;
  const current = opening + net;
  return Number.isSafeInteger(current) ? current / 100 : null;
}

// The user edits their CURRENT balance, not their opening balance.
// Keep all ledger rows unchanged; shift the base so that
// updated initial_balance + existing transaction net = requested current balance.
// The derived base may be negative when credits already exceed the target.
export function openingBalanceForTarget(
  currentBalance: number,
  transactionNet: number,
): number | null {
  if (!isValidIdrAmount(currentBalance, true)) return null;
  const target = centsOf(currentBalance);
  const net = centsOf(transactionNet);
  if (target === null || net === null) return null;
  const opening = target - net;
  return Number.isSafeInteger(opening) ? opening / 100 : null;
}
