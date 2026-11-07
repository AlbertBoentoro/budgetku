// IDR can include up to two fractional digits (sen).
// Numbers stay unscaled in database/RPC payloads. For cent-bearing values,
// require safe integer cents so the browser never silently drops precision.
export function isValidIdrAmount(value: unknown, allowZero = false): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) ||
      (allowZero ? value < 0 : value <= 0)) return false;
  if (Number.isSafeInteger(value)) return true;
  const cents = value * 100;
  return Number.isSafeInteger(Math.round(cents)) &&
    Math.abs(cents - Math.round(cents)) < 0.000001;
}

// Keyboards in different locales may insert a dot. Interpret it as the
// decimal key only when it is a newly appended dot or an unambiguously
// non-thousands "1234.56" / "0.41" paste. A dot followed by three
// digits stays an Indonesian thousands separator.
export function normalizeIdrDecimalKey(raw: string, previous = ""): string {
  // Explicitly appended decimal key: distinct from auto-created thousands dots.
  if (raw === previous + "." && !previous.includes(",")) {
    return (previous || "0") + ",";
  }
  const decimal = /^(Rp\s*)?(\d+)\.(\d{1,2})$/i.exec(raw);
  if (!decimal) return raw;
  // A dot from an already-grouped integer ("Rp 12.500" -> "Rp 12.50"
  // after Backspace) must NEVER turn into a decimal comma.
  if (previous.includes(".") && !previous.includes(",")) return raw;
  // A prefixed, already-formatted amount is ambiguous except 0.41.
  if (decimal[1] && decimal[2] !== "0") return raw;
  // Interpret a direct decimal paste into an empty/zero field; do not
  // reinterpret arbitrary editing of an existing integer.
  if (previous && !["0", "Rp 0"].includes(previous)) return raw;
  return raw.replace(/\.(\d{1,2})$/, ",$1");
}

// Selective recovery and its database RPC are bounded at Rp 1 trillion.
export const MAX_RESTORABLE_TRANSACTION_AMOUNT = 1_000_000_000_000;
export function isValidTransactionIdrAmount(value: unknown): value is number {
  return isValidIdrAmount(value) &&
    value <= MAX_RESTORABLE_TRANSACTION_AMOUNT;
}

export function addIdrAmounts(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

export function formatIdrCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
