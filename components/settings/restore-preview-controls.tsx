"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { BACKUP_CREATED_EVENT } from "@/components/settings/backup-events";
import { SmartRestoreSelector, type SmartRestorePreview } from "@/components/settings/smart-restore-selector";

type Snapshot = { name: string; createdAt: string; size: number | null };
type Counts = {
  current: number; backup: number;
  wouldAdd: number; wouldUpdate: number; wouldRemove: number;
};
type ReadOnlyPreview = {
  previewOnly: true;
  restoreExecutionEnabled: false;
  eligibleForAtomicRestore: boolean;
  blockers: string[];
  backupGeneratedAt: string;
  externalGmailLinks: number;
  backupSha256: string;
  currentSha256: string;
  smartRestoreEnabled?: boolean;
  smartRestore?: SmartRestorePreview | null;
  tables: Record<string, Counts>;
};

const TABLE_NAMES: Record<string, string> = {
  accounts: "Rekening",
  budgets: "Anggaran",
  budgetItems: "Pos anggaran",
  categories: "Kategori",
  transactions: "Transaksi",
  recurringTransactions: "Transaksi berulang",
  financialGoals: "Tujuan keuangan",
  goalContributions: "Kontribusi tujuan",
  merchantRules: "Aturan merchant",
};

function dateLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Jakarta",
  }).format(date) + " WIB";
}

export function RestorePreviewControls({ smartRestoreMode = false }: { smartRestoreMode?: boolean }) {
  const [history, setHistory] = useState<Snapshot[]>([]);
  const historyRequestId = useRef(0);
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<ReadOnlyPreview | null>(null);
  const [error, setError] = useState("");

  async function loadHistory(signal?: AbortSignal, preferLatest = false) {
    const requestId = ++historyRequestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/settings/backup/history", {
        cache: "no-store", signal,
      });
      if (!response.ok) throw new Error("Riwayat cadangan gagal dimuat.");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" ||
          !("snapshots" in payload) || !Array.isArray(payload.snapshots)) {
        throw new Error("Riwayat cadangan tidak valid.");
      }
      const entries = (payload.snapshots as Snapshot[]).filter(
        (row) => typeof row.name === "string" && typeof row.createdAt === "string",
      );
      if (signal?.aborted || historyRequestId.current !== requestId) return;
      setHistory(entries);
      setSnapshot((previous) => preferLatest ? (entries[0]?.name ?? "") :
        entries.some((row) => row.name === previous)
          ? previous : (entries[0]?.name ?? ""));
      setPreview(null);
    } catch (cause) {
      if (signal?.aborted || historyRequestId.current !== requestId) return;
      setError(cause instanceof Error ? cause.message : "Riwayat gagal dimuat.");
    } finally {
      if (!signal?.aborted && historyRequestId.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    const onBackupCreated = () => {
      // A new immutable snapshot is committed before POST returns 200.
      // Select that newest version, rather than leaving a stale dropdown.
      controller.abort();
      void loadHistory(undefined, true);
    };
    window.addEventListener(BACKUP_CREATED_EVENT, onBackupCreated);
    return () => {
      controller.abort();
      window.removeEventListener(BACKUP_CREATED_EVENT, onBackupCreated);
    };
  }, []);

  async function inspect() {
    if (!snapshot || checking) return;
    setChecking(true);
    setPreview(null);
    setError("");
    try {
      const response = await fetch("/api/settings/restore/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ snapshot }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const reason = result && typeof result === "object" && "error" in result
          ? (result as { error: unknown }).error : null;
        throw new Error(typeof reason === "string" ? reason : "Pratinjau gagal.");
      }
      if (!result || typeof result !== "object" ||
          !("previewOnly" in result) || result.previewOnly !== true ||
          !("restoreExecutionEnabled" in result) ||
          result.restoreExecutionEnabled !== false ||
          !("tables" in result) || !("blockers" in result)) {
        throw new Error("Respons pratinjau tidak valid.");
      }
      setPreview(result as ReadOnlyPreview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pratinjau gagal.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section aria-labelledby="restore-preview-title"
      className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-1">
        <h3 id="restore-preview-title" className="text-body-md font-semibold text-on-surface">
          {smartRestoreMode ? "Pulihkan transaksi dari cadangan" : "Bandingkan isi backup"}
        </h3>
        <p className="text-body-sm text-on-surface-variant">
          {smartRestoreMode
            ? "Pilih backup, lalu centang transaksi yang ingin dikembalikan. Transaksi terbaru tetap disimpan."
            : "Lihat perbedaan antara isi backup dan data sekarang tanpa mengubah apa pun. Untuk mengembalikan transaksi yang hilang, buka Transaksi → Pulihkan transaksi."}
        </p>
      </div>
      <label htmlFor="restore-preview-snapshot"
        className="text-body-sm font-medium text-on-surface">
        Versi cadangan
      </label>
      <select id="restore-preview-snapshot" value={snapshot}
        className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-surface-container-lowest px-3 text-body-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => {
          setSnapshot(event.target.value);
          setPreview(null);
          setError("");
        }}
        disabled={loading || checking || history.length === 0}>
        {history.length === 0 ? (
          <option value="">{loading ? "Memuat cadangan..." : "Belum ada cadangan bertanggal"}</option>
        ) : history.map((entry, index) => (
          <option key={entry.name} value={entry.name}>
            {dateLabel(entry.createdAt)} — {index === 0 ? "Terbaru" : `Cadangan ${index + 1}`}
          </option>
        ))}
      </select>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="min-h-11 sm:flex-1"
          disabled={!snapshot || loading || checking} onClick={inspect}>
          {checking ? "Memeriksa cadangan..." : smartRestoreMode ? "Cari transaksi yang hilang" : "Bandingkan isi backup"}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 sm:w-auto"
          disabled={loading || checking} onClick={() => void loadHistory()}>
          {loading ? "Memuat..." : "Muat ulang daftar"}
        </Button>
      </div>
      {preview ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p role="status" className="text-body-sm font-medium text-on-surface">
            {smartRestoreMode
              ? "Pemeriksaan selesai. Pilih transaksi yang ingin dikembalikan."
              : "Pratinjau saja. Tidak ada data yang dipulihkan atau diubah."}
          </p>
          <p className="text-body-sm text-on-surface-variant">
            Dibuat {dateLabel(preview.backupGeneratedAt)}.
            {preview.externalGmailLinks
              ? " " + preview.externalGmailLinks + " transaksi terkait Gmail ikut diperiksa."
              : ""}
          </p>
          {!smartRestoreMode ? <div className="max-w-full overflow-x-auto">
            <table aria-label="Perbandingan data cadangan"
              className="w-full min-w-[340px] text-left text-body-sm text-on-surface">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th scope="col" className="py-2 pr-2 font-medium">Data</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Tambah</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Ubah</th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">Hapus</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(preview.tables).map(([key, counts]) => (
                  <tr key={key} className="border-b border-outline-variant/60">
                    <th scope="row" className="py-2 pr-2 font-normal">
                      {TABLE_NAMES[key] ?? key}
                    </th>
                    <td className="px-2 py-2 text-right tabular-nums">{counts.wouldAdd}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{counts.wouldUpdate}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{counts.wouldRemove}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div> : null}
          {smartRestoreMode && preview.smartRestoreEnabled && preview.smartRestore ? (
            <SmartRestoreSelector key={snapshot + preview.backupSha256} snapshot={snapshot}
              backupSha256={preview.backupSha256} currentSha256={preview.currentSha256}
              plan={preview.smartRestore} />
          ) : null}
          {!smartRestoreMode ? (preview.blockers.length ? (
            <div role="alert" className="text-body-sm text-expense">
              <p className="font-medium">Masalah yang perlu dibereskan sebelum pemulihan:</p>
              <ul className="ml-5 list-disc space-y-1">
                {preview.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-body-sm text-on-surface-variant">
              Belum ditemukan konflik pada pemeriksaan awal. Ini bukan jaminan
              bahwa pemulihan data sudah aman atau tersedia.
            </p>
          )) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="text-body-sm text-expense">{error}</p> : null}
    </section>
  );
}
