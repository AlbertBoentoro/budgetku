"use client";

import { useState, useTransition } from "react";
import { Mail, RefreshCw } from "lucide-react";

import {
  disconnectGmail,
  syncGmail,
  type ActionResult,
} from "@/app/(app)/settings/gmail/actions";
import { Button } from "@/components/ui/button";

interface GmailConnectionPanelProps {
  emailAddress: string;
  // ISO timestamp of the last successful sync, or null if never synced.
  lastSyncedAt: string | null;
}

// Absolute, locale-aware last-sync label. Kept absolute (not "x minutes ago")
// so it never drifts between server render and client without a live clock.
function formatLastSynced(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Connected state (design §11). Shows the connected address and last-sync time,
 * a "Sync sekarang" button that calls syncGmail via useTransition (disabled and
 * labeled "Menyinkronkan..." while pending), and a quiet "Putuskan koneksi"
 * action guarded by window.confirm then disconnectGmail, matching the
 * recurring-list-row destructive-action pattern.
 */
export function GmailConnectionPanel({
  emailAddress,
  lastSyncedAt,
}: GmailConnectionPanelProps) {
  const [isSyncing, startSync] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    start: (cb: () => void) => void,
    fn: () => Promise<ActionResult>,
  ) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.message);
    });
  }

  function handleSync() {
    run(startSync, () => syncGmail());
  }

  function handleDisconnect() {
    const confirmed = window.confirm(
      "Putuskan koneksi Gmail? Token akses akan dihapus. Transaksi yang sudah kamu simpan tetap ada.",
    );
    if (!confirmed) return;
    run(startDisconnect, () => disconnectGmail());
  }

  const busy = isSyncing || isDisconnecting;
  const lastSyncedLabel = lastSyncedAt ? formatLastSynced(lastSyncedAt) : "";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-sm font-medium">{emailAddress}</h2>
          <p className="text-sm text-muted-foreground">
            {lastSyncedLabel
              ? `Terakhir disinkronkan: ${lastSyncedLabel}`
              : "Belum pernah disinkronkan"}
          </p>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleSync}
          disabled={busy}
          className="h-11"
        >
          <RefreshCw aria-hidden />
          {isSyncing ? "Menyinkronkan..." : "Sync sekarang"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleDisconnect}
          disabled={busy}
          className="h-11 text-muted-foreground"
        >
          {isDisconnecting ? "Memutuskan..." : "Putuskan koneksi"}
        </Button>
      </div>
    </section>
  );
}
