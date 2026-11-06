// Keep every rupiah write within the exact, recoverable range.
// The selective-restore planner/RPC currently cap an amount at Rp 1 trillion.
// Do not raise this without updating those paths and database RPC checks.
export const MAX_TRANSACTION_AMOUNT = 1_000_000_000_000;
export const TRANSACTION_AMOUNT_ERROR =
  "Nominal harus berupa rupiah bulat antara Rp 1 dan Rp 1.000.000.000.000.";

export function isValidTransactionAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_TRANSACTION_AMOUNT
  );
}
