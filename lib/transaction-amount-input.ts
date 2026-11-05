/**
 * Presentation-only formatter for integer IDR inputs.
 * The decimal value stored in the database is never rescaled.
 * Keep the typing state as grouped digits, e.g. 1234 -> "1.234".
 */
export function formatTransactionAmountInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Accept only the exact format emitted above. Do not silently interpret
 * decimals or invalid text as another amount, and reject unsafe JS integers.
 */
export function parseTransactionAmountInput(raw: string): number | null {
  if (!/^(?:0|[1-9]\d{0,2}(?:\.\d{3})*)$/.test(raw)) return null;
  const value = Number(raw.replace(/\./g, ""));
  return Number.isSafeInteger(value) ? value : null;
}
