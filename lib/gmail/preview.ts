import type { Json } from "@/lib/supabase/database.types";
import type { ParseResult } from "@/lib/gmail/parsers";

export type GmailSource = "bca" | "shopee" | "gopay";

export interface GmailParsedPreview {
  source: GmailSource | null;
  amount: number | null;
  direction: "income" | "expense" | null;
  transactionAt: string | null;
  merchant: string | null;
  description: string | null;
  confidence: "high" | "low";
}

export const GMAIL_SOURCE_LABELS: Record<GmailSource, string> = {
  bca: "BCA",
  shopee: "ShopeePay",
  gopay: "GoPay",
};

export function createGmailPreview(
  source: GmailSource | null,
  result: ParseResult,
): Json {
  return {
    source,
    amount: result.amount,
    direction: result.direction,
    transactionAt: result.transactionAt,
    merchant: result.merchant,
    description: result.description,
    confidence: result.confidence,
  };
}

export function readGmailPreview(value: Json | null): GmailParsedPreview | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  const sourceValue = value.source;
  const source =
    sourceValue === "bca" ||
    sourceValue === "shopee" ||
    sourceValue === "gopay"
      ? sourceValue
      : sourceValue === null
        ? null
        : undefined;
  const amountValue = value.amount;
  const amount =
    typeof amountValue === "number" &&
    Number.isFinite(amountValue) &&
    amountValue > 0
      ? amountValue
      : amountValue === null
        ? null
        : undefined;
  const directionValue = value.direction;
  const direction =
    directionValue === "income" || directionValue === "expense"
      ? directionValue
      : directionValue === null
        ? null
        : undefined;
  const transactionAtValue = value.transactionAt;
  const transactionAt =
    typeof transactionAtValue === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(transactionAtValue)
      ? transactionAtValue
      : transactionAtValue === null
        ? null
        : undefined;
  const merchantValue = value.merchant;
  const merchant =
    typeof merchantValue === "string" || merchantValue === null
      ? merchantValue
      : undefined;
  const descriptionValue = value.description;
  const description =
    typeof descriptionValue === "string" || descriptionValue === null
      ? descriptionValue
      : undefined;
  const confidenceValue = value.confidence;
  const confidence =
    confidenceValue === "high" || confidenceValue === "low"
      ? confidenceValue
      : undefined;

  if (
    source === undefined ||
    amount === undefined ||
    direction === undefined ||
    transactionAt === undefined ||
    merchant === undefined ||
    description === undefined ||
    confidence === undefined
  ) {
    return null;
  }

  return {
    source,
    amount,
    direction,
    transactionAt,
    merchant,
    description,
    confidence,
  };
}
