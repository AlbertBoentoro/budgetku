import { AmountText } from "@/components/finance/amount-text";
import { formatGmailDate } from "@/lib/gmail/date-format";
import type { GmailParsedPreview } from "@/lib/gmail/preview";

export function GrabGmailSummary({ preview, receivedAt }: {
  preview: GmailParsedPreview;
  receivedAt: string | null;
}) {
  const date = formatGmailDate(preview.transactionAt ?? receivedAt, { dateStyle: "medium" });
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-surface-container-low p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm font-semibold text-on-surface dark:text-white">{date || "Tanggal belum terbaca"}</p>
        <span className="rounded-full bg-surface-container px-2.5 py-1 text-label-xs text-on-surface-variant">Dari Gmail</span>
      </div>
      <p className="text-body-sm font-medium text-on-surface-variant">Transaksi Grab</p>
      {preview.amount !== null ? (
        <AmountText value={-preview.amount} tone="expense" size="lg" className="block max-w-full whitespace-normal break-words font-bold" />
      ) : <p className="text-body-md text-on-surface-variant">Nominal belum terbaca</p>}
      <div className="min-w-0">
        <p className="text-label-xs text-on-surface-variant">Toko</p>
        <p className="text-body-md font-medium text-on-surface">Grab</p>
      </div>
      <div className="min-w-0">
        <p className="text-label-xs text-on-surface-variant">Catatan</p>
        <p className="break-words text-body-md text-on-surface">{preview.description || "Catatan belum terbaca"}</p>
      </div>
    </div>
  );
}
