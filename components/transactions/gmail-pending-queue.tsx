"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ignoreImport } from "@/app/(app)/settings/gmail/actions";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatGmailDate } from "@/lib/gmail/date-format";
import type { GmailParsedPreview } from "@/lib/gmail/preview";

export interface PendingGmailTransaction {
  id: string;
  subject: string | null;
  receivedAt: string | null;
  preview: GmailParsedPreview | null;
}

interface GmailPendingQueueProps {
  drafts: PendingGmailTransaction[];
  total: number;
}

/**
 * The Gmail inbox is a review queue, NOT a second transaction ledger.
 * An email does not alter the balance until its account, category and amount
 * are confirmed via the existing user-scoped Gmail import form.
 */
export function GmailPendingQueue({ drafts, total }: GmailPendingQueueProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function decline(id: string) {
    if (isPending || busyId !== null) return;
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await ignoreImport(id);
        if (!result.ok) {
          setError(result.message);
        } else {
          router.refresh();
        }
      } catch {
        setError("Gagal menolak draft. Coba lagi.");
      } finally {
        setBusyId(null);
      }
    });
  }

  if (total === 0) return null;

  return (
    <section
      aria-labelledby="gmail-pending-title"
      className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="gmail-pending-title" className="flex items-center gap-2 text-title-md text-on-surface">
            <Icon name="mail" size={20} className="shrink-0 text-on-surface-variant" />
            Menunggu persetujuan Gmail
          </h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {total} draft belum masuk saldo. Terima untuk memeriksa rekening dan kategori, atau Tolak.
          </p>
        </div>
        <Link
          href="/settings/gmail"
          className="inline-flex min-h-11 items-center text-body-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Lihat semua
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-expense/40 p-3 text-body-sm text-expense">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-outline-variant">
        {drafts.map((draft) => {
          const preview = draft.preview;
          const title = preview?.merchant?.trim() || draft.subject?.trim() || "Email transaksi";
          const date = formatGmailDate(draft.receivedAt, { dateStyle: "medium" });
          return (
            <li key={draft.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-body-md font-medium text-on-surface">{title}</p>
                  <p className="text-body-sm text-on-surface-variant">
                    {date || "Tanggal email tidak tersedia"} · {preview?.source?.toUpperCase() || "Gmail"}
                  </p>
                </div>
                {preview?.amount !== null && preview?.amount !== undefined ? (
                  <AmountText
                    value={preview.amount}
                    tone={preview.direction === "income" ? "income" : preview.direction === "expense" ? "expense" : "default"}
                    size="md"
                    className="shrink-0 tabular-nums"
                  />
                ) : (
                  <span className="text-body-sm text-on-surface-variant">Periksa nominal</span>
                )}
              </div>
              {preview?.confidence === "low" ? (
                <p className="text-body-sm text-on-surface-variant">
                  Hasil deteksi belum pasti. Periksa email sebelum mencatat.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="min-h-11">
                  <Link href={`/settings/gmail?review=${encodeURIComponent(draft.id)}`}>
                    Terima
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => decline(draft.id)}
                  disabled={isPending || busyId !== null}
                  aria-label={`Tolak draft Gmail: ${title}`}
                >
                  {busyId === draft.id ? "Memproses…" : "Tolak"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-label-md text-on-surface-variant">
        Periksa transaksi yang sudah dicatat manual supaya tidak dihitung dua kali.
      </p>
    </section>
  );
}
