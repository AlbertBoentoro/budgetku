"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { syncGmail } from "@/app/(app)/settings/gmail/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatGmailDate } from "@/lib/gmail/date-format";

interface GmailSyncBarProps {
  emailAddress: string | null;
  connected: boolean;
  lastSyncedAt: string | null;
}

/**
 * Same authenticated server action as Settings > Gmail. This is a manual
 * Gmail-to-draft sync; it NEVER approves an email or changes account balances.
 */
export function GmailSyncBar({
  emailAddress,
  connected,
  lastSyncedAt,
}: GmailSyncBarProps) {
  const router = useRouter();
  const [isSyncing, startSync] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSync() {
    if (isSyncing) return;
    setError(null);
    setNotice(null);
    startSync(async () => {
      try {
        const result = await syncGmail();
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setNotice("Sinkronisasi selesai. Periksa draft Gmail sebelum mencatat.");
        router.refresh();
      } catch {
        setError("Gagal menyinkronkan Gmail. Periksa koneksi lalu coba lagi.");
      }
    });
  }

  const lastSyncLabel = formatGmailDate(lastSyncedAt, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section
      aria-label="Sinkronisasi Gmail"
      className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
            <Icon name="mail" size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-body-md font-semibold text-on-surface">Impor dari Gmail</h2>
            <p className="break-words text-body-sm text-on-surface-variant">
              {connected
                ? `${emailAddress || "Gmail terhubung"} · Terakhir sync: ${lastSyncLabel || "Belum pernah"}`
                : "Gmail belum terhubung atau perlu dihubungkan ulang."}
            </p>
          </div>
        </div>
        {connected ? (
          <Button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-11"
            aria-label="Sinkronkan email Gmail sekarang"
          >
            <Icon name="sync" size={18} aria-hidden />
            {isSyncing ? "Menyinkronkan..." : "Sync sekarang"}
          </Button>
        ) : (
          <Button asChild variant="outline" className="h-11">
            <Link href="/settings/gmail">Hubungkan Gmail</Link>
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-expense">{error}</p>
      ) : null}
      {notice ? (
        <p role="status" className="text-body-sm text-on-surface-variant">{notice}</p>
      ) : null}
    </section>
  );
}
