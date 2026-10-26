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
// The compact draft summary uses the most useful transaction label available:
// merchant, payment recipient, transaction type, then transfer type.

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

const MERCHANT_FIELDS: {
  kind: "merchant" | "recipient" | "transaction" | "transfer";
  label: string;
}[] = [
  { kind: "merchant", label: "merchant" },
  { kind: "recipient", label: "payment to" },
  {
    kind: "recipient",
    label: "company/product name",
  },
  { kind: "transaction", label: "transaction type" },
  { kind: "transfer", label: "transfer type" },
];

const EMAIL_FIELD_LABELS = [
  ...MERCHANT_FIELDS.map((field) => field.label),
  "total payment",
  "pay amount",
  "amount",
  "jumlah",
  "nominal",
  "transaction date",
  "date",
  "time",
  "reference number",
  "reference no",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFieldValue(bodyText: string, label: string): string | null {
  const nextField = EMAIL_FIELD_LABELS.map(escapeRegExp).join("|");
  const pattern = new RegExp(
    `(?:^|\\s)${escapeRegExp(label)}\\s*:\\s*(.+?)(?=\\s+(?:${nextField})\\s*:|$)`,
    "i",
  );

  for (const line of bodyText.split(/\r?\n/)) {
    const value = line.match(pattern)?.[1]?.trim();
    if (value) return value;
  }

  const normalized = bodyText.replace(/\s+/g, " ").trim();
  return normalized.match(pattern)?.[1]?.trim() ?? null;
}

export function extractBcaDraftSummary(bodyText: string): string | null {
  if (typeof bodyText !== "string") return null;

  for (const field of MERCHANT_FIELDS) {
    const value = extractFieldValue(bodyText, field.label);
    if (!value) continue;
    if (field.kind === "merchant") {
      return value.split("*", 1)[0].trim() || null;
    }
    if (field.kind === "transaction") {
      const walletProvider = value.match(/^e-wallet\s*-\s*(.+)$/i)?.[1];
      if (!walletProvider) return value;
      const provider = walletProvider.trim();
      if (provider.toLowerCase() === "shopeepay") return "ShopeePay";
      if (provider.toLowerCase() === "gopay") return "GoPay";
      return provider;
    }
    if (field.kind === "transfer") {
      const recipient = value.match(
        /^transfer\s+to\s+(.+?)(?:\s+account)?$/i,
      )?.[1];
      return recipient ? `Transfer ke ${recipient.trim()}` : value;
    }
    return value;
  }
  return null;
}

export const bcaParser: GmailParser = {
  source: "bca",
  parse({ subject, bodyText, receivedAt }): ParseResult {
    const haystack = `${subject}\n${bodyText}`.toLowerCase();
    const amount = parseRupiah(bodyText) ?? parseRupiah(subject);

    // Keep a readable merchant or transaction label even when the amount is
    // missing, so the failed draft still gives the user useful context.
    if (amount === null) {
      return {
        ok: false,
        amount: null,
        direction: null,
        transactionAt: null,
        merchant: extractBcaDraftSummary(bodyText),
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
      merchant: extractBcaDraftSummary(bodyText),
      description: subject.trim() || "Transaksi BCA",
      confidence,
    };
  },
};
