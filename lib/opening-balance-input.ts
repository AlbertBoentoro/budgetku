// Opening-balance ("Saldo awal") input with Indonesian grouping and sen,
// e.g. "Rp 261.157,41". Values are stored as real IDR, never rescaled.
//
import { isValidIdrAmount, normalizeIdrDecimalKey } from "./idr-money.ts";

const PREFIX = "Rp ";

const onlyDigits = (text: string) => text.replace(/[^0-9]/g, "");

function formatDigits(digits: string): string {
  if (!digits) return "";
  return PREFIX + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Formats whatever the user typed: keeps the digits, drops leading zeros,
// groups thousands with ".", and adds the "Rp " prefix. No digits -> "".
export function formatOpeningBalanceInput(raw: string): string {
  // Conventional pasted "Rp 1.000,-" means whole Rupiah, not pending sen.
  const cleaned = normalizeIdrDecimalKey(raw).replace(/,\s*-\s*$/, "").replace(/[^0-9,]/g, "");
  const comma = cleaned.indexOf(",");
  const integer = (comma < 0 ? cleaned : cleaned.slice(0, comma))
    .replace(/^0+(?=\d)/, "");
  const fraction = comma < 0 ? null : cleaned.slice(comma + 1).replace(/,/g, "").slice(0, 2);
  if (!integer && fraction === null) return "";
  return formatDigits(integer || "0") + (fraction === null ? "" : "," + fraction);
}

// Caret position in `formatted` just after its `digitCount`-th digit. With no
// digits before the caret it sits right after "Rp ".
export function caretAfterDigits(formatted: string, digitCount: number): number {
  if (!formatted) return 0;
  if (digitCount <= 0) return formatted.startsWith(PREFIX) ? PREFIX.length : 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9" && ++seen === digitCount) {
      return i + 1;
    }
  }
  return formatted.length;
}

export interface OpeningBalanceEdit {
  value: string;
  caret: number;
}

// Applies one browser edit to the field and says where the caret goes.
//
// `previous` is the formatted value before the edit; `raw` and `caret` are the
// input's value and selectionEnd right after the browser applied the edit
// (typing, paste, cut, Backspace, Delete, or replacing a selection), and
// `inputType` is InputEvent.inputType when available.
//
// The caret is kept by digit count, not by string index: the number of digits
// left of the caret is the same before and after formatting, while the index
// moves whenever a "." separator is added or removed.
//
// Backspace or Delete next to a "." would only remove the separator, which
// formatting puts straight back. In that case the neighbouring digit is
// removed instead, so the key always deletes a digit.
export function applyOpeningBalanceEdit(
  previous: string,
  raw: string,
  caret: number,
  inputType?: string,
): OpeningBalanceEdit {
  const at = Math.max(0, Math.min(caret, raw.length));
  const edited = normalizeIdrDecimalKey(raw, previous).replace(/,\s*-\s*$/, "");
  const commaAt = edited.indexOf(",");
  // Never silently truncate existing digits when a comma is inserted inside
  // an integer with more than two digits to its right.
  if (commaAt >= 0 && onlyDigits(edited.slice(commaAt + 1)).length > 2) {
    return { value: previous, caret: Math.max(0, at - 1) };
  }
  let digits = onlyDigits(edited);
  let before = onlyDigits(edited.slice(0, at)).length;
  const hasComma = commaAt >= 0;
  let integerLength = hasComma ? onlyDigits(edited.slice(0, commaAt)).length : digits.length;

  // Exactly one "." was removed at the caret (Backspace and Delete both leave
  // the caret at the removed character's index). Removing a character of the
  // "Rp " prefix is not upgraded; formatting simply restores the prefix.
  const removedOnlyFormatting =
    previous.length - raw.length === 1 &&
    previous[at] === "." &&
    digits === onlyDigits(previous);
  if (removedOnlyFormatting && inputType === "deleteContentBackward" && before > 0) {
    digits = digits.slice(0, before - 1) + digits.slice(before);
    if (before <= integerLength) integerLength -= 1;
    before -= 1;
  } else if (
    removedOnlyFormatting &&
    inputType === "deleteContentForward" &&
    before < digits.length
  ) {
    digits = digits.slice(0, before) + digits.slice(before + 1);
    if (before < integerLength) integerLength -= 1;
  }

  // Leading zeros are dropped; those left of the caret no longer count.
  const leadingZeros = digits.length - digits.replace(/^0+(?=\d)/, "").length;
  digits = digits.slice(leadingZeros);
  before = Math.max(0, before - leadingZeros);
  integerLength = Math.max(0, integerLength - leadingZeros);

  const value = hasComma
    ? formatDigits(digits.slice(0, integerLength) || "0") + "," +
      digits.slice(integerLength).slice(0, 2)
    : formatDigits(digits);
  // When a comma is newly typed, keep the caret *after* the comma. Mapping
  // by digit count alone would put it back before the comma.
  const commaImmediatelyBeforeCaret = hasComma && edited.slice(0, at).endsWith(",");
  return {
    value,
    caret: commaImmediatelyBeforeCaret
      ? value.indexOf(",") + 1
      : caretAfterDigits(value, before + (hasComma && integerLength === 0 ? 1 : 0)),
  };
}

// Existing decimal balances must round-trip without truncating sen.
export function openingBalanceInputFromValue(value: number): string {
  if (isValidIdrAmount(value, true)) {
    return formatOpeningBalanceInput(String(value).replace(".", ","));
  }
  return String(value);
}

// Opening balance may be zero; at most two digits of sen.
export function parseOpeningBalanceInput(display: string): number | null {
  const text = display.trim();
  if (text === "") return 0;
  const body = text.startsWith("Rp") ? text.slice(2).trim() : text;
  if (!/^(?:0|[1-9]\d{0,2}(?:\.\d{3})*)(?:,\d{1,2})?$/.test(body)) return null;
  const value = Number(body.replace(/\./g, "").replace(",", "."));
  return isValidIdrAmount(value, true) ? value : null;
}
