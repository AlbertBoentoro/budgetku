import { isValidIdrAmount } from "./idr-money.ts";

// Editable Indonesian amount: dot separates thousands, comma separates sen.
// Keep an unfinished trailing comma so users can type "0," then "0,41".
export function formatTransactionAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9,]/g, "");
  const comma = cleaned.indexOf(",");
  const integer = (comma < 0 ? cleaned : cleaned.slice(0, comma))
    .replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (comma < 0) return grouped;
  const fraction = cleaned.slice(comma + 1).replace(/,/g, "").slice(0, 2);
  return (grouped || "0") + "," + fraction;
}

// A number read from Supabase uses "." for its JS fraction; convert it
// explicitly before applying Indonesian grouping. Never read its dot as
// a thousands separator.
export function transactionAmountInputFromValue(value: number): string {
  if (!isValidIdrAmount(value, true)) return String(value);
  return formatTransactionAmountInput(String(value).replace(".", ","));
}

// Strict parser: "1.234,41" -> 1234.41; "0,41" -> 0.41; "1.234" -> 1234.
// Dot is never decimal. Reject malformed grouping, >2 sen digits, and unsafe
// values rather than guessing what the user meant.
export function parseTransactionAmountInput(raw: string): number | null {
  if (!/^(?:0|[1-9]\d{0,2}(?:\.\d{3})*)(?:,\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  return isValidIdrAmount(value, true) ? value : null;
}
