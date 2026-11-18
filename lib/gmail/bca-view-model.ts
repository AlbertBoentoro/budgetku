import type { GmailParsedPreview } from "@/lib/gmail/preview";

/** Only use structured labels explicitly recognized by the BCA parser. */
export function getBcaGmailViewModel(preview: GmailParsedPreview) {
  const description = preview.description?.trim() ?? "";
  const title = /^(?:Transfer ke .+|Transaksi QRIS)$/i.test(description)
    ? description
    : "Transaksi BCA";
  return {
    title,
    date: preview.transactionAt,
    recipient: preview.merchant?.trim() || "Penerima belum terdeteksi",
    amount: preview.amount,
    direction: preview.direction,
  };
}
