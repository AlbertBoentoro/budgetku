// Shared IDR Rupiah + Indonesian date helpers for the Gmail parsers
// (design §6.2). Pure functions: no I/O, no state.
//
// IMPORTANT: this file handles the EMAIL TEXTUAL format of a Rupiah amount,
// which is NOT the same as the typed-form input handled by parseIdrInput in
// lib/accounts.ts. Real bank/e-wallet emails arrive in two conventions:
//   - English/BCA: "IDR 23,900.00" / "IDR 5,000.00" — comma = thousands,
//     dot = decimal.
//   - Indonesian:  "Rp1.234.567" / "Rp1.234.567,89" — dot = thousands,
//     comma = decimal.
// parseIdrInput assumes ONE locale (Indonesian typed input: strip ".",
// convert "," → "."). Applying that here would misread "IDR 5,000.00" as 5.
// The two functions therefore intentionally DIVERGE and must NOT be unified:
// parseIdrInput owns user-typed input, parseRupiah owns email text.

// Matches a Rupiah amount only when it is immediately preceded by an explicit
// "Rp" or "IDR" marker (case-insensitive, optional spaces). Requiring the
// prefix is the fix for the real bug: a bare number such as the day "14" in
// "Transaction Date : 14 Oct 2026", a terminal ID, a PAN, or an account number
// must NEVER be read as an amount. The capture is the full numeric token,
// including any "." / "," separators and trailing fraction; normalizeAmount
// decides how to interpret the separators.
const RUPIAH_AMOUNT_PATTERN = /(?:rp|idr)\s*([\d.,]+)/gi;

// Labeled-total precedence (documented order). When several Rp/IDR amounts
// appear in one body, the amount on a line carrying one of these labels is the
// authoritative transaction total. Tried in order; the first label that yields
// a valid amount wins. If none match, parseRupiah falls back to the LARGEST
// valid Rp/IDR amount in the whole text (a safe, honest choice that still
// cannot select a bare date because the Rp/IDR prefix is required).
const TOTAL_LABELS = [
  "total payment",
  "pay amount",
  "amount",
  "jumlah",
  "nominal",
];

/**
 * Normalize a single numeric token (the digits + "." / "," separators that
 * followed an "Rp"/"IDR" marker) into a positive whole-rupiah integer, or null.
 *
 * Separator rules (structural, locale-agnostic):
 *   - If BOTH "." and "," appear, the one that appears LAST is the decimal
 *     separator; the other is the thousands separator. The decimal fraction is
 *     dropped (IDR stores no minor units). So:
 *       "23,900.00" -> dot last  -> 23900
 *       "1.234.567,89" -> comma last -> 1234567
 *   - If only ONE separator type appears:
 *       * a single occurrence leaving exactly 2 trailing digits that looks
 *         like a decimal fraction (",00" / ".00" i.e. all-zero or a plain
 *         2-digit cents group) is treated as a decimal and dropped, so
 *         "5,00" -> 5 and "5.00" -> 5;
 *       * otherwise every occurrence is a thousands separator and removed, so
 *         "5,000" -> 5000, "5.000" -> 5000, "1.234.567" -> 1234567.
 *   - The result must be a finite integer strictly greater than 0, else null.
 *
 * The four BCA sample values worked through this rule:
 *   "23,900.00" -> both, dot last -> drop ".00", strip ","  -> 23900
 *   "50,000.00" -> both, dot last -> drop ".00", strip ","  -> 50000
 *   "5,000.00"  -> both, dot last -> drop ".00", strip ","  -> 5000
 *   "60,000.00" -> both, dot last -> drop ".00", strip ","  -> 60000
 * Indonesian: "1.234.567" -> single ".", 3-digit groups -> thousands -> 1234567
 *             "1.234.567,89" -> both, comma last -> drop ",89" -> 1234567
 */
function normalizeAmount(token: string): number | null {
  if (typeof token !== "string") return null;
  // Keep only digits and separators; a stray trailing "." (sentence period)
  // would otherwise distort the "last separator" check.
  const cleaned = token.replace(/[^\d.,]/g, "").replace(/[.,]+$/, "");
  if (cleaned === "") return null;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let integerPart: string;

  if (hasDot && hasComma) {
    // Both present: the LAST separator is the decimal; everything before it is
    // the integer part with thousands separators (which we strip).
    const lastSep = cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")
      ? "."
      : ",";
    const cut = cleaned.lastIndexOf(lastSep);
    integerPart = cleaned.slice(0, cut).replace(/[.,]/g, "");
  } else if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const parts = cleaned.split(sep);
    const last = parts[parts.length - 1];
    // A single separator with a 2-digit trailing group is a decimal fraction
    // ONLY when it looks like cents (so "5,00" -> 5); otherwise the separator
    // is a thousands grouping ("5,000" / "5.000" -> 5000, "1.234.567" ->
    // 1234567).
    const isDecimalFraction = parts.length === 2 && last.length === 2;
    integerPart = isDecimalFraction
      ? parts[0]
      : parts.join("");
  } else {
    integerPart = cleaned;
  }

  if (integerPart === "") return null;
  const n = Number(integerPart);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

// Collect every valid Rp/IDR-prefixed amount in `text`, in order of appearance.
function collectAmounts(text: string): number[] {
  const amounts: number[] = [];
  for (const match of text.matchAll(RUPIAH_AMOUNT_PATTERN)) {
    const value = normalizeAmount(match[1]);
    if (value !== null) amounts.push(value);
  }
  return amounts;
}

/**
 * Parse the authoritative Rupiah amount from `text` into a positive unscaled
 * integer, or null when no confident amount is present.
 *
 * An amount is ONLY recognized when prefixed by an explicit "Rp"/"IDR" marker,
 * so bare numbers (dates, PANs, terminal IDs, account numbers) are never
 * matched. Selection precedence:
 *   1. A labeled total: the Rp/IDR amount on a line whose label is (in order)
 *      "Total Payment", "Pay Amount", then "Amount"/"Jumlah"/"Nominal".
 *   2. Fallback: the LARGEST valid Rp/IDR amount anywhere in the text.
 * Returns null when no Rp/IDR amount is present, or the amount is 0/negative/
 * non-numeric, so the caller sets ok:false rather than fabricate a value.
 */
export function parseRupiah(text: string): number | null {
  if (typeof text !== "string") return null;

  // 1) Labeled-total precedence, scanning line by line so a label only claims
  //    an amount on its own line.
  const lines = text.split(/\r?\n/);
  for (const label of TOTAL_LABELS) {
    for (const line of lines) {
      const lower = line.toLowerCase();
      const labelIndex = lower.indexOf(label);
      if (labelIndex === -1) continue;
      // Only match an Rp/IDR amount that appears AFTER the label on the line.
      const afterLabel = line.slice(labelIndex + label.length);
      const amounts = collectAmounts(afterLabel);
      if (amounts.length > 0) return amounts[0];
    }
  }

  // 2) Fallback: largest valid Rp/IDR amount anywhere.
  const all = collectAmounts(text);
  if (all.length === 0) return null;
  return Math.max(...all);
}

// Indonesian + English month names (and common 3-letter abbreviations) mapped
// to a 1-based month number. Bank/e-wallet emails mix Indonesian ("Mei",
// "Agustus", "Okt") and occasionally English, so both are accepted.
const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  ags: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

// dd/mm/yyyy or dd-mm-yyyy (also accepts 2-digit years, expanded to 20xx).
const NUMERIC_DATE_PATTERN = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;
// "dd Mon yyyy" / "dd Mmmm yyyy" (e.g. "7 Okt 2026", "07 Oktober 2026").
const TEXT_DATE_PATTERN = /\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/;

// Pad to a two-digit string for "YYYY-MM-DD" assembly.
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Validate real calendar bounds and assemble the ISO date, or return null when
// the day/month are out of range (e.g. 31/02) so a bogus match is not trusted.
function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// Expand a 2-digit year to 20xx; leave 4-digit years as-is.
function normalizeYear(raw: number): number {
  return raw < 100 ? 2000 + raw : raw;
}

/**
 * Find the first confident Indonesian date in `text` and return it as
 * "YYYY-MM-DD". Supports dd/mm/yyyy, dd-mm-yyyy, dd Mon yyyy, and
 * dd Mmmm yyyy. On no confident match, fall back to the date portion of
 * `fallbackReceivedAt` (the email's received_at); the caller marks that case
 * confidence 'low'. Returns null only when the fallback itself is unusable.
 */
export function parseIndonesianDate(
  text: string,
  fallbackReceivedAt: string,
): string | null {
  if (typeof text === "string") {
    const numeric = text.match(NUMERIC_DATE_PATTERN);
    if (numeric) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]);
      const year = normalizeYear(Number(numeric[3]));
      const iso = toIsoDate(year, month, day);
      if (iso) return iso;
    }

    const textual = text.match(TEXT_DATE_PATTERN);
    if (textual) {
      const day = Number(textual[1]);
      const month = MONTHS[textual[2].toLowerCase()];
      const year = Number(textual[3]);
      if (month) {
        const iso = toIsoDate(year, month, day);
        if (iso) return iso;
      }
    }
  }

  return receivedAtToIsoDate(fallbackReceivedAt);
}

// Reduce an ISO-ish timestamp to its "YYYY-MM-DD" date, or null when it is not
// a parseable date. Exported so callers can detect "fell back to received_at".
export function receivedAtToIsoDate(receivedAt: string): string | null {
  if (typeof receivedAt !== "string" || receivedAt === "") return null;
  const d = new Date(receivedAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )}`;
}
