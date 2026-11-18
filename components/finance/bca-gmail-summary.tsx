import { AmountText } from "@/components/finance/amount-text";
import { formatGmailDate } from "@/lib/gmail/date-format";
import { getBcaGmailViewModel } from "@/lib/gmail/bca-view-model";
import type { GmailParsedPreview } from "@/lib/gmail/preview";

export function BcaGmailSummary({
  preview,
  receivedAt,
}: {
  preview: GmailParsedPreview;
  receivedAt: string | null;
}) {
  const { sourceLabel, title, date, recipient, amount, direction } = getBcaGmailViewModel(preview);
  const formattedDate = formatGmailDate(date ?? receivedAt, { dateStyle: "medium" });
  const displayValue = amount === null
    ? null
    : direction === "expense" ? -amount : amount;
  const tone = direction === "income"
    ? "income" : direction === "expense" ? "expense" : "default";

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-surface-container-low p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm font-semibold text-on-surface dark:text-white">
          {formattedDate || "Tanggal belum terbaca"}
        </p>
        <span className="rounded-full bg-surface-container px-2.5 py-1 text-label-xs text-on-surface-variant">
          Dari Gmail
        </span>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-body-sm font-medium text-on-surface-variant">{sourceLabel}</p>
        <p className="break-words text-body-md font-semibold text-on-surface">{title}</p>
      </div>
      {displayValue !== null ? (
        <AmountText
          value={displayValue}
          tone={tone}
          size="lg"
          className="block max-w-full whitespace-normal break-words font-bold"
        />
      ) : (
        <p className="text-body-md text-on-surface-variant">
          Nominal belum terbaca
        </p>
      )}
      <div className="min-w-0">
        <p className="text-label-xs text-on-surface-variant">Kepada</p>
        <p className="break-words text-body-md font-medium text-on-surface">
          {recipient}
        </p>
      </div>
    </div>
  );
}
