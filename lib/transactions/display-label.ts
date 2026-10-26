import { extractBcaDraftSummary } from "@/lib/gmail/parsers/bca";

interface TransactionLabelFields {
  merchant: string | null;
  description: string | null;
}

function isStructuredEmailBody(value: string): boolean {
  return (
    value.length > 160 &&
    /\b(?:merchant|payment to|company\/product name|transaction type|transfer type|pay amount|total payment)\s*:/i.test(
      value,
    )
  );
}

export function getTransactionDisplayLabel(
  transaction: TransactionLabelFields,
  categoryName: string | null,
  fallbackLabel: string,
): string {
  const merchant = transaction.merchant?.trim() ?? "";
  const description = transaction.description?.trim() ?? "";
  const emailBody = isStructuredEmailBody(merchant)
    ? merchant
    : isStructuredEmailBody(description)
      ? description
      : null;

  if (emailBody) {
    return extractBcaDraftSummary(emailBody) ?? categoryName ?? fallbackLabel;
  }

  return merchant || description || categoryName || fallbackLabel;
}
