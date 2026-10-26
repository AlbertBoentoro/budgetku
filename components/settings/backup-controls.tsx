"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function BackupControls({
  lastBackupAt,
  hasBackup,
  configured,
}: {
  lastBackupAt: string | null;
  hasBackup: boolean;
  configured: boolean;
}) {
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
      router.refresh();
    } catch {
      setMessage("Cadangan gagal dibuat karena koneksi terputus.");
    } finally {
      setPending(false);
    }
  }

  const formattedBackupDate = lastBackupAt
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(lastBackupAt))
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div>
        <p className="text-body-md font-medium text-on-surface">
          Cadangan cloud otomatis
        </p>
        <p className="text-body-sm text-on-surface-variant">
          {formattedBackupDate
            ? `Terakhir dibuat ${formattedBackupDate} WIB.`
            : hasBackup
              ? "Cadangan cloud tersedia."
              : "Cadangan pertama belum dibuat."}
        </p>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Transaksi tetap tersimpan di Supabase. Cadangan tambahan mencakup
          transaksi, rekening, anggaran, dan preferensi. Budgetku memperbarui
          salinan sekitar pukul 20.00 WIB setiap hari, lalu mengganti salinan
          sebelumnya. Pemulihan otomatis belum tersedia.
        </p>
        {!configured ? (
          <p role="status" className="mt-1 text-body-sm text-expense">
            Cadangan otomatis belum berjalan karena konfigurasi server belum
            lengkap.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={createBackup}
          disabled={pending}
          className="h-11 w-full sm:flex-1"
        >
          <Icon name="backup" size={19} />
          {pending ? "Membuat cadangan..." : "Cadangkan sekarang"}
        </Button>
        {hasBackup ? (
          <Button
            asChild
            variant="outline"
            className="h-11 w-full sm:flex-1"
          >
            <a href="/api/settings/backup">
              <Icon name="download" size={19} />
              Unduh cadangan
            </a>
          </Button>
        ) : null}
      </div>
      {message ? (
        <p
          role="status"
          className="text-body-sm text-on-surface-variant"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
