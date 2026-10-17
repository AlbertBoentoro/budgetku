"use client";

import { useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";

import {
  ignoreImport,
  type ActionResult,
} from "@/app/(app)/settings/gmail/actions";
import { Button } from "@/components/ui/button";

// One row's worth of STORED honest metadata (design §4.4 step 1: list rows use
// stored metadata only, never a per-row Gmail get and never a parsed amount).
export interface GmailDraftView {
  id: string;
  subject: string | null;
  sender: string | null;
  receivedAt: string | null;
  status: "needs_review" | "failed";
  failureReason: string | null;
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
 * One draft row in "Perlu ditinjau". Shows stored metadata only and never an
 * invented amount. A needs_review row offers "Tinjau" (navigates with
 * ?review=<id>, letting the server re-fetch + re-parse that one message) and
 * "Abaikan". A failed row shows an honest "cannot read" note and only "Abaikan".
 */
export function GmailDraftRow({ draft, onError }: GmailDraftRowProps) {
  const [isPending, startTransition] = useTransition();

  const received = formatReceived(draft.receivedAt);
  const senderLabel = formatSender(draft.sender);
  const isFailed = draft.status === "failed";

  function handleIgnore() {
    startTransition(async () => {
      const result: ActionResult = await ignoreImport(draft.id);
      if (!result.ok) onError(result.message);
    });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-start gap-3">
        {isFailed ? (
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <Mail
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {draft.subject?.trim() || "(Tanpa subjek)"}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {senderLabel}
            {received ? ` · ${received}` : ""}
          </span>
          {isFailed ? (
            <span className="text-sm text-muted-foreground">
              Tidak bisa membaca detail dari email ini.
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Perlu dicek sebelum disimpan.
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pl-8">
        {!isFailed ? (
          <Button asChild size="sm" className="h-9">
            <Link href={`/settings/gmail?review=${draft.id}`} scroll={false}>
              Tinjau
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground"
          onClick={handleIgnore}
          disabled={isPending}
        >
          {isPending ? "Memproses..." : "Abaikan"}
        </Button>
      </div>
    </li>
  );
}
