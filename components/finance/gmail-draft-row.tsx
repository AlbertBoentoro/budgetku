"use client";

import { useTransition } from "react";
import Link from "next/link";

import {
  ignoreImport,
  type ActionResult,
} from "@/app/(app)/settings/gmail/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { GmailParsedPreview } from "@/lib/gmail/preview";

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
          <div className="min-w-0">
            <p className="text-label-xs text-on-surface-variant">
              Ringkasan transaksi
            </p>
            <p className="break-words text-body-sm text-on-surface">
              {preview.merchant?.trim() || "Belum terbaca"}
            </p>
          </div>
          {preview.confidence === "low" ? (
            <p className="text-body-sm text-on-surface-variant">
              Periksa kembali hasil deteksi sebelum menyimpan.
            </p>
          ) : null}
          {isFailed ? (
            <p className="text-body-sm text-on-surface-variant">
              {draft.failureReason ?? "Detail transaksi belum bisa dibaca."}
            </p>
          ) : null}
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
