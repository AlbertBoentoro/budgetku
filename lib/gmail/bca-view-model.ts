import type { GmailParsedPreview } from "@/lib/gmail/preview";

/** Presentation data only: parsing and normalization belong to the BCA parser. */
export function getBcaGmailViewModel(preview: GmailParsedPreview) {
  const description = preview.description?.trim() ?? "";
  const title = /^(?:Transfer ke .+|Top up ke .+|Transaksi QRIS|Top Up Flazz)$/i.test(description)
    ? description
    : "Jenis transaksi belum terbaca";

  // Existing V4 drafts sometimes contain multiple email fields in "merchant".
  // Do not show bank/account/phone data as a recipient while awaiting re-sync.
  const rawRecipient = preview.merchant?.trim() ?? "";
  const hasEmbeddedFields = /\b(?:source of fund|source currency|transfer currency|beneficiary (?:account|name)|phone no\.?|admin fee|total payment|transfer amount|reference no\.?)\s*:/i.test(rawRecipient);
  const recipient = rawRecipient && !hasEmbeddedFields
    ? rawRecipient
    : "Penerima belum terdeteksi";

  return {
    sourceLabel: "Transaksi BCA",
    title,
    date: preview.transactionAt,
    recipient,
    amount: preview.amount,
    direction: preview.direction,
  };
}
