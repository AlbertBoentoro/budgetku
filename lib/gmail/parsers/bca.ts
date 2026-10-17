// BCA email parser (design §6.3). Best-effort and honest: when the body has no
// parseable amount, return ok:false with no fabricated value. Direction is
// decided by Indonesian debit/credit keywords; when both or neither are
// present the result defaults to expense at confidence 'low' so the user can
// correct it.
//
// Direction decision (documented):
//   - income is chosen ONLY when an explicit Indonesian income keyword is
//     matched and outnumbers the expense keywords.
//   - expense is chosen when expense keywords win, OR as the default when the
//     keywords are ambiguous/absent. English BCA debit notifications in the
//     wild ("QRIS Payment", "Transfer to BCA Virtual Account") contain no
//     Indonesian keyword, so they land in this expense default — which is
//     correct, because those notifications are money LEAVING the account. The
//     result stays confidence 'low' unless the direction and date are both
//     independently confirmed.
//
// Keyword sets (documented, editable — bank copy drifts over time):
//   expense (money leaving the account): "debet"/"debit", "transfer ke",
//     "pembayaran", "pembelian", "tarik tunai", "biaya"/"administrasi".
//   income (money arriving): "kredit", "transfer dari", "penerimaan",
//     "setoran", "masuk", "diterima".
//
// Merchant extraction: QRIS payment emails carry the counterparty after a
// "Payment to" label; transfer emails carry it after "Company/Product Name".
// Whichever is present (checked in that order) becomes the merchant; when
// neither appears, merchant stays null (never fabricated).

import type { GmailParser, ParseResult } from "./types";
import {
  parseIndonesianDate,
  parseRupiah,
  receivedAtToIsoDate,
} from "./money";

const EXPENSE_KEYWORDS = [
  "debet",
  "debit",
  "transfer ke",
  "pembayaran",
  "pembelian",
  "tarik tunai",
  "biaya",
  "administrasi",
];

const INCOME_KEYWORDS = [
  "kredit",
  "transfer dari",
  "penerimaan",
  "setoran",
  "masuk",
  "diterima",
];

function countMatches(haystack: string, keywords: string[]): number {
  return keywords.reduce(
    (count, kw) => (haystack.includes(kw) ? count + 1 : count),
    0,
  );
}

// Read the counterparty label from the body. QRIS payments use "Payment to";
// transfers use "Company/Product Name". The value is the remainder of the
// label's line, trimmed. Returns null when no label is present (do not
// fabricate a merchant).
const MERCHANT_LABELS = ["payment to", "company/product name"];

function extractMerchant(bodyText: string): string | null {
  if (typeof bodyText !== "string") return null;
  const lines = bodyText.split(/\r?\n/);
  for (const label of MERCHANT_LABELS) {
    for (const line of lines) {
      const lower = line.toLowerCase();
      const labelIndex = lower.indexOf(label);
      if (labelIndex === -1) continue;
      // Take everything after the label, then drop a leading ":"/separator.
      const after = line
        .slice(labelIndex + label.length)
        .replace(/^\s*:?\s*/, "")
        .trim();
      if (after !== "") return after;
    }
  }
  return null;
}

export const bcaParser: GmailParser = {
  source: "bca",
  parse({ subject, bodyText, receivedAt }): ParseResult {
    const haystack = `${subject}\n${bodyText}`.toLowerCase();
    const amount = parseRupiah(bodyText) ?? parseRupiah(subject);

    // No confident amount => needs_review, never fabricate one.
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

    const expenseHits = countMatches(haystack, EXPENSE_KEYWORDS);
    const incomeHits = countMatches(haystack, INCOME_KEYWORDS);

    let direction: ParseResult["direction"];
    let directionConfident: boolean;
    if (expenseHits > incomeHits) {
      direction = "expense";
      directionConfident = true;
    } else if (incomeHits > expenseHits) {
      direction = "income";
      directionConfident = true;
    } else {
      // Ambiguous (both or neither matched): default to expense but flag it so
      // the user confirms, rather than guessing a sign with high confidence.
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
      merchant: extractMerchant(bodyText),
      description: subject.trim() || "Transaksi BCA",
      confidence,
    };
  },
};
