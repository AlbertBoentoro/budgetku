// Pure CSV serialization helpers (RFC 4180, comma delimiter, CRLF rows).
// No imports so the escaping rules can be checked with plain `node`.

/** UTF-8 byte order mark: lets Excel detect UTF-8 for Indonesian text. */
export const CSV_BOM = "\uFEFF";

// First characters a spreadsheet may treat as the start of a formula
// (CSV/formula injection). Tab and CR are included per OWASP guidance.
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

// Characters that force a quoted field.
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * Serialize a text cell. Empty for null/undefined. A value starting with a
 * formula trigger is prefixed with a single quote so it opens as text, then
 * the result is quoted (inner quotes doubled) when it contains a quote,
 * comma, CR, LF, or leading/trailing whitespace.
 */
export function csvText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  let cell = value;
  if (cell.length > 0 && FORMULA_TRIGGERS.has(cell[0])) {
    cell = `'${cell}`;
  }
  if (NEEDS_QUOTES.test(cell) || cell !== cell.trim()) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Serialize a numeric cell as the raw value (no currency, no separators).
 * A finite number such as `-5000` stays unquoted and unguarded: a cell made
 * only of an optional minus and digits is parsed as a number, not a formula,
 * and prefixing it would break spreadsheet sums. Non-finite input goes
 * through the text path.
 */
export function csvNumber(value: number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return csvText(String(value));
}

/**
 * Join already-serialized cells into a CSV document: BOM prefix, comma
 * between cells, CRLF after every row (including the last).
 */
export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((cells) => cells.join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
