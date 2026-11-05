"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BACKUP_CREATED_EVENT } from "@/components/settings/backup-events";

// Manual backup controls remain available; the scheduled backup is deliberately
// invisible here but continues through the secured server-only cron endpoint.
export function BackupControls({ hasBackup }: { hasBackup: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function createBackup() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/backup", { method: "POST" });
      if (!response.ok) {
        setMessage(await response.text());
        return;
      }
      const result: { message: string } = await response.json();
      setMessage(result.message);
      window.dispatchEvent(new Event(BACKUP_CREATED_EVENT));
      router.refresh();
    } catch {
      setMessage("Cadangan gagal dibuat karena koneksi terputus.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div aria-label="Cadangan manual"
      className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={createBackup} disabled={pending}
          className="h-11 w-full sm:flex-1">
          <Icon name="backup" size={19} />
          {pending ? "Membuat cadangan..." : "Cadangkan sekarang"}
        </Button>
        {hasBackup ? (
          <Button asChild variant="outline" className="h-11 w-full sm:flex-1">
            <a href="/api/settings/backup">
              <Icon name="download" size={19} />
              Unduh cadangan
            </a>
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role="status"
          className="text-body-sm text-on-surface-variant" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
