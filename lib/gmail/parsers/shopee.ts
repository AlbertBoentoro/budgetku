// Shopee / ShopeePay email parser (design §6.3). Order and payment
// confirmations are money leaving the user (expense); refunds are money
// returning (income). Best-effort and honest: no parseable amount => ok:false
// with no fabricated value.
//
// Keyword sets (documented, editable — Shopee copy drifts over time):
//   income (money returning): "pengembalian dana", "refund", "dana dikembalikan",
//     "pembatalan".
//   expense (money leaving): "pesanan", "pembayaran", "berhasil dibayar",
//     "transaksi", "top up"/"top-up", "pembelian".
// Refund keywords take precedence over the broad expense set so a refund email
// that still mentions "pesanan" is not misread as a purchase.

import type { GmailParser, ParseResult } from "./types";
import {
  parseIndonesianDate,
  parseRupiah,
  receivedAtToIsoDate,
} from "./money";

const INCOME_KEYWORDS = [
  "pengembalian dana",
  "refund",
  "dana dikembalikan",
  "pembatalan",
];

const EXPENSE_KEYWORDS = [
  "pesanan",
  "pembayaran",
  "berhasil dibayar",
  "transaksi",
  "top up",
  "top-up",
  "pembelian",
];

function hasAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((kw) => haystack.includes(kw));
}

export const shopeeParser: GmailParser = {
  source: "shopee",
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

    const isRefund = hasAny(haystack, INCOME_KEYWORDS);
    const isPurchase = hasAny(haystack, EXPENSE_KEYWORDS);

    let direction: ParseResult["direction"];
    let directionConfident: boolean;
    if (isRefund) {
      // Refund keywords win over the broad expense set.
      direction = "income";
      directionConfident = true;
    } else if (isPurchase) {
      direction = "expense";
      directionConfident = true;
    } else {
      // No signal: default to expense (the common case) but flag it.
      direction = "expense";
      directionConfident = false;
    }

    const detectedDate = parseIndonesianDate(bodyText, receivedAt);
    const dateConfident = detectedDate !== receivedAtToIsoDate(receivedAt);

    const confidence: ParseResult["confidence"] =
      directionConfident && dateConfident ? "high" : "low";

    return {
      ok: true,
      amount,
      direction,
      transactionAt: detectedDate,
      merchant: "Shopee",
      description: subject.trim() || "Transaksi Shopee",
      confidence,
    };
  },
};
