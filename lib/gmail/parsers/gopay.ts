// GoPay email parser (design §6.3). GoPay movements are easy to misclassify:
// a top-up INTO GoPay or a cashback is not the same as a payment OUT of a bank
// account, and the mental model of "which account moved" varies by user.
// Design decision: default to expense but ALWAYS mark confidence 'low' so the
// user explicitly confirms the sign in review. Never guess a sign silently as
// high-confidence. Best-effort and honest: no parseable amount => ok:false.
//
// Keyword sets (documented, editable — GoPay/Gojek copy drifts over time).
// These only nudge the default direction; confidence stays 'low' regardless.
//   income (money returning to the user): "cashback", "pengembalian",
//     "refund", "diterima", "masuk".
//   expense (money leaving): "pembayaran", "transaksi", "transfer",
//     "pembelian", "top up"/"top-up".

import type { GmailParser, ParseResult } from "./types";
import { parseIndonesianDate, parseRupiah } from "./money";

const INCOME_KEYWORDS = [
  "cashback",
  "pengembalian",
  "refund",
  "diterima",
  "masuk",
];

const EXPENSE_KEYWORDS = [
  "pembayaran",
  "transaksi",
  "transfer",
  "pembelian",
  "top up",
  "top-up",
];

function hasAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((kw) => haystack.includes(kw));
}

export const gopayParser: GmailParser = {
  source: "gopay",
  parse({ subject, bodyText, receivedAt }): ParseResult {
    const haystack = `${subject}\n${bodyText}`.toLowerCase();
    const amount = parseRupiah(bodyText) ?? parseRupiah(subject);

    if (amount === null) {
      return {
        ok: false,
        amount: null,
        direction: null,
        transactionAt: null,
        merchant: null,
        description: null,
        confidence: "low",
      };
    }

    // The keywords only choose the default sign; GoPay is always surfaced at
    // confidence 'low' so the user confirms income vs expense in review.
    let direction: ParseResult["direction"] = "expense";
    if (hasAny(haystack, INCOME_KEYWORDS) && !hasAny(haystack, EXPENSE_KEYWORDS)) {
      direction = "income";
    }

    const detectedDate = parseIndonesianDate(bodyText, receivedAt);

    return {
      ok: true,
      amount,
      direction,
      transactionAt: detectedDate,
      merchant: "GoPay",
      description: subject.trim() || "Transaksi GoPay",
      confidence: "low",
    };
  },
};
