// Opening-balance ("Saldo awal") input: the field itself shows Rupiah, e.g.
// typing 123133 displays "Rp 123.133". Whole rupiah only, like the
// transaction amount input; the stored number is never rescaled.
//
// No imports on purpose, so this can be unit-tested in plain Node.

const PREFIX = "Rp ";

// Formats whatever the user typed: keeps the digits, drops leading zeros,
// groups thousands with ".", and adds the "Rp " prefix. No digits -> "".
export function formatOpeningBalanceInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return PREFIX + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// The initial text for an existing balance. A legacy non-integer value is
// shown unchanged (not rounded), so parsing fails and the user must retype it
// instead of the value being changed silently.
export function openingBalanceInputFromValue(value: number): string {
  if (Number.isSafeInteger(value) && value >= 0) {
    return formatOpeningBalanceInput(String(value));
  }
  return String(value);
}

// Parses the displayed text back to a number. An empty field means 0, as
// before. Returns null for anything that is not the format above or not a
// safe integer.
export function parseOpeningBalanceInput(display: string): number | null {
  const text = display.trim();
  if (text === "") return 0;
  const body = text.startsWith("Rp") ? text.slice(2).trim() : text;
  if (!/^(?:0|[1-9]\d{0,2}(?:\.\d{3})*)$/.test(body)) return null;
  const value = Number(body.replace(/\./g, ""));
  return Number.isSafeInteger(value) ? value : null;
}
