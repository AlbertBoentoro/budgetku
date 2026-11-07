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
