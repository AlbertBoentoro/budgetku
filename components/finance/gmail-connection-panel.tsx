"use client";

import { useState, useTransition } from "react";

import {
  disconnectGmail,
  syncGmail,
  type ActionResult,
} from "@/app/(app)/settings/gmail/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

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
    <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="mail" size={22} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-title-md text-on-surface">
            {emailAddress}
          </h2>
          {/* "Aktif" carries the state as text; the emerald dot is a redundant
              cue, so meaning never rests on color alone. */}
          <p className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            <span
              className="size-2 shrink-0 rounded-full bg-secondary"
              aria-hidden
            />
            <span className="font-medium text-on-surface">Aktif</span>
            <span aria-hidden>{"\u00b7"}</span>
            <span>
              Sinkronisasi:{" "}
              {lastSyncedLabel ? lastSyncedLabel : "Belum pernah"}
            </span>
          </p>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
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
          <Icon name="sync" size={18} aria-hidden />
          {isSyncing ? "Menyinkronkan..." : "Sync sekarang"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleDisconnect}
          disabled={busy}
          className="h-11 text-on-surface-variant"
        >
          {isDisconnecting ? "Memutuskan..." : "Putuskan koneksi"}
        </Button>
      </div>
    </section>
  );
}
