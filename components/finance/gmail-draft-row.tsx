"use client";

import { useTransition } from "react";
import Link from "next/link";

import {
  ignoreImport,
  type ActionResult,
} from "@/app/(app)/settings/gmail/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  GMAIL_SOURCE_LABELS,
  type GmailParsedPreview,
} from "@/lib/gmail/preview";

// One row's stored email metadata and safely parsed preview.
export interface GmailDraftView {
  id: string;
  subject: string | null;
  sender: string | null;
  receivedAt: string | null;
  status: "needs_review" | "failed";
  failureReason: string | null;
  preview: GmailParsedPreview | null;
}

interface GmailDraftRowProps {
  draft: GmailDraftView;
  onError: (message: string) => void;
}

// Absolute received date (date only). No time-ago to avoid server/client drift.
function formatReceived(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

// Trim a raw "From" header to a readable label. Prefers the display name,
// falls back to the bare address.
function formatSender(sender: string | null): string {
  if (!sender) return "Pengirim tidak diketahui";
  const angle = sender.match(/^\s*"?([^"<]+?)"?\s*</);
  if (angle && angle[1].trim()) return angle[1].trim();
  return sender.trim();
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTransactionDate(date: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    parsed,
  );
}

/**
 * One draft row in "Perlu ditinjau". Shows stored email metadata and parser
 * results. A needs_review row offers "Tinjau" and "Abaikan"; a failed row can
 * be ignored and explains which details could not be read.
 */
export function GmailDraftRow({ draft, onError }: GmailDraftRowProps) {
  const [isPending, startTransition] = useTransition();

  const received = formatReceived(draft.receivedAt);
  const senderLabel = formatSender(draft.sender);
  const isFailed = draft.status === "failed";
  const preview = draft.preview;
  const transactionDate = formatTransactionDate(
    preview?.transactionAt ?? null,
  );

  function handleIgnore() {
    startTransition(async () => {
      const result: ActionResult = await ignoreImport(draft.id);
      if (!result.ok) onError(result.message);
    });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name={isFailed ? "error" : "mail"} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="break-words text-body-md text-on-surface">
            {draft.subject?.trim() || "(Tanpa subjek)"}
          </span>
          <span className="break-words text-body-sm text-on-surface-variant">
            {senderLabel}
            {received ? ` \u00b7 ${received}` : ""}
          </span>
        </div>
      </div>

      {preview ? (
        <div className="ml-0 flex flex-col gap-2 rounded-lg bg-surface-container-low p-3 sm:ml-[52px]">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-label-xs text-on-surface-variant">Nominal</dt>
              <dd className="break-words text-body-md font-semibold tabular-nums text-on-surface">
                {preview.amount === null
                  ? "Belum terbaca"
                  : `Rp ${formatAmount(preview.amount)}`}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label-xs text-on-surface-variant">Jenis</dt>
              <dd className="break-words text-body-sm text-on-surface">
                {preview.direction === "income"
                  ? "Pemasukan"
                  : preview.direction === "expense"
                    ? "Pengeluaran"
                    : "Belum terbaca"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label-xs text-on-surface-variant">Tanggal transaksi</dt>
              <dd className="break-words text-body-sm text-on-surface">
                {transactionDate ?? "Belum terbaca"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label-xs text-on-surface-variant">Bank / layanan</dt>
              <dd className="break-words text-body-sm text-on-surface">
                {preview.source
                  ? GMAIL_SOURCE_LABELS[preview.source]
                  : "Belum dikenali"}
              </dd>
            </div>
          </dl>
          {preview.merchant ? (
            <p className="break-words text-body-sm text-on-surface">
              Merchant: {preview.merchant}
            </p>
          ) : null}
          {preview.description ? (
            <p className="break-words text-body-sm text-on-surface-variant">
              Deskripsi: {preview.description}
            </p>
          ) : null}
          {preview.confidence === "low" ? (
            <p className="text-body-sm text-on-surface-variant">
              Periksa kembali hasil deteksi sebelum menyimpan.
            </p>
          ) : null}
          {isFailed ? (
            <p className="text-body-sm text-on-surface-variant">
              {draft.failureReason ?? "Detail transaksi belum bisa dibaca."}
            </p>
          ) : (
            <p className="text-body-sm text-on-surface-variant">
              Periksa detail ini sebelum menyimpan.
            </p>
          )}
        </div>
      ) : (
        <p className="ml-0 break-words text-body-sm text-on-surface-variant sm:ml-[52px]">
          Detail transaksi belum dimuat. Tekan Sync sekarang untuk melengkapi
          daftar.
        </p>
      )}

      <div className="flex items-center gap-2 pl-0 sm:pl-[52px]">
        {!isFailed ? (
          <Button asChild size="sm" className="h-11">
            <Link href={`/settings/gmail?review=${draft.id}`} scroll={false}>
              Tinjau
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 text-on-surface-variant"
          onClick={handleIgnore}
          disabled={isPending}
        >
          {isPending ? "Memproses..." : "Abaikan"}
        </Button>
      </div>
    </li>
  );
}
