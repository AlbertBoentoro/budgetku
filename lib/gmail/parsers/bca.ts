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
  { kind: "recipient", label: "beneficiary name" },
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
  "transfer amount",
  "name",
  "phone no.",
  "admin fee",
  "status",
  "note(s)",
  "beneficiary account",
  "source of fund",
  "source currency",
  "transfer currency",
  "remarks",
  "reference no.",
  "total payment",
  "pay amount",
  "amount",
  "jumlah",
  "nominal",
  "merchant location",
  "merchant pan",
  "customer pan",
  "terminal id",
  "acquirer",
  "transaction date",
  "date",
  "time",
  "reference number",
  "reference no",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * myBCA emails can arrive as either neatly separated rows or flattened HTML.
 * Tokenize field labels first, then read only until the next known field.
 * A single global scan prevents "Name" inside "Beneficiary Name" from being
 * mistaken for an independent wallet recipient.
 */
function extractBcaFields(bodyText: string): Map<string, string> {
  const fields = new Map<string, string>();
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  const labels = EMAIL_FIELD_LABELS
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp("(?:^|\\s)(" + labels + ")\\s*:\\s*", "gi");
  const matches = Array.from(normalized.matchAll(pattern));

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const label = match[1].toLowerCase();
    const from = (match.index ?? 0) + match[0].length;
    const to = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    const value = normalized.slice(from, to).trim();
    if (value && !fields.has(label)) fields.set(label, value);
  }
  return fields;
}

function extractFieldValue(bodyText: string, label: string): string | null {
  return extractBcaFields(bodyText).get(label.toLowerCase()) ?? null;
}

function walletLabel(value: string): string {
  const canonical: Record<string, string> = {
    shopeepay: "ShopeePay",
    gopay: "GoPay",
    dana: "DANA",
    ovo: "OVO",
    linkaja: "LinkAja",
  };
  const trimmed = value.trim();
  return canonical[trimmed.toLowerCase()] ?? trimmed;
}

export function extractBcaDraftSummary(bodyText: string): string | null {
  if (typeof bodyText !== "string") return null;
  const normalized = bodyText.replace(/\s+/g, " ").trim();

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

  const legacyMerchantLocation = normalized.match(
    /(?:^|\s)([^:]+?)\s+merchant\s+location\s*:\s*(.+?)(?=\s+(?:acquirer|merchant\s+pan|customer\s+pan|terminal\s+id|total\s+payment|pay\s+amount|reference\s+no|reference\s+number)\s*:|$)/i,
  );
  if (legacyMerchantLocation) {
    const merchant = legacyMerchantLocation[1].trim();
    const location = legacyMerchantLocation[2].trim();
    if (merchant && location) return `${merchant} · ${location}`;
    return merchant || location || null;
  }

  return null;
}

export const bcaParser: GmailParser = {
  source: "bca",
  parse({ subject, bodyText, receivedAt }): ParseResult {
    const haystack = (subject + "\n" + bodyText).toLowerCase();
    const fields = extractBcaFields(bodyText);
    const field = (label: string): string | null => fields.get(label) ?? null;

    const transferType = field("transfer type");
    const transactionType = field("transaction type");
    const beneficiary = field("beneficiary name");
    const walletOwner = field("name");
    const paymentTo = field("payment to");
    const isBankTransfer = /^transfer\s+to\s+\S+/i.test(transferType ?? "");
    const isQris = /^qris\s+payment$/i.test(transactionType ?? "");
    const walletMatch = transactionType?.match(/^e[-\s]?wallet\s*-\s*(.+)$/i);
    const isWalletTopUp = Boolean(walletMatch);
    const wallet = walletMatch ? walletLabel(walletMatch[1]) : null;

    const bankMatch = transferType?.match(/^transfer\s+to\s+(.+?)(?:\s+(?:virtual\s+)?account)?$/i);
    const bank = bankMatch?.[1]?.trim() || null;
    const transactionTitle = isBankTransfer
      ? "Transfer ke " + (bank || "rekening")
      : isWalletTopUp
        ? "Top up ke " + (wallet || "e-wallet")
        : isQris ? "Transaksi QRIS" : null;

    const amountText = isBankTransfer
      ? field("transfer amount")
      : field("total payment") ?? field("pay amount") ?? field("amount");
    // Prefer the exact amount field. Avoid reading an account number, admin
    // fee, or other unrelated value as the transaction amount.
    const amount = amountText
      ? parseRupiah(amountText)
      : parseRupiah(bodyText) ?? parseRupiah(subject);

    const recipient = isBankTransfer
      ? beneficiary
      : isWalletTopUp
        ? walletOwner
        : isQris ? paymentTo : extractBcaDraftSummary(bodyText);

    if (amount === null) {
      return {
        ok: false,
        amount: null,
        direction: null,
        transactionAt: null,
        merchant: recipient,
        description: transactionTitle,
        confidence: "low",
      };
    }

    const expenseHits = countMatches(haystack, EXPENSE_KEYWORDS);
    const incomeHits = countMatches(haystack, INCOME_KEYWORDS);

    let direction: ParseResult["direction"];
    let directionConfident: boolean;
    if (isBankTransfer || isQris || isWalletTopUp) {
      direction = "expense";
      directionConfident = true;
    } else if (expenseHits > incomeHits) {
      direction = "expense";
      directionConfident = true;
    } else if (incomeHits > expenseHits) {
      direction = "income";
      directionConfident = true;
    } else {
      direction = "expense";
      directionConfident = false;
    }

    const transactionDateText = field("transaction date");
    const parsedExplicitDate = transactionDateText
      ? parseIndonesianDate(transactionDateText, "")
      : null;
    const detectedDate = parsedExplicitDate ?? parseIndonesianDate(bodyText, receivedAt);
    const dateConfident = Boolean(parsedExplicitDate) ||
      detectedDate !== receivedAtToIsoDate(receivedAt);

    const confidence: ParseResult["confidence"] =
      directionConfident && dateConfident &&
      (!transactionTitle || Boolean(recipient)) ? "high" : "low";

    return {
      ok: true,
      amount,
      direction,
      transactionAt: detectedDate,
      merchant: recipient,
      description: transactionTitle ?? (subject.trim() || "Transaksi BCA"),
      confidence,
    };
  },
};
