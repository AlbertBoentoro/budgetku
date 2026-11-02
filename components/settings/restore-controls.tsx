"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const CONFIRMATION = "PULIHKAN DATA";

type BackupRecord = { name: string; createdAt: string; size: number | null };
type Counts = { current: number; backup: number; wouldAdd: number; wouldUpdate: number; wouldRemove: number };
type Preview = {
  previewOnly: boolean;
  eligibleForAtomicRestore: boolean;
  blockers: string[];
  backupGeneratedAt: string;
  backupSha256: string;
  currentSha256: string;
  externalGmailLinks: number;
  tables: Record<string, Counts>;
};
const LABELS: Record<string, string> = {
  accounts: "Rekening", budgets: "Anggaran", budgetItems: "Pos anggaran",
  categories: "Kategori", transactions: "Transaksi",
  recurringTransactions: "Transaksi berulang", financialGoals: "Target keuangan",
  goalContributions: "Kontribusi target", merchantRules: "Aturan merchant",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
    }).format(new Date(value));
  } catch { return "Tanggal tidak tersedia"; }
}

export function RestoreControls() {
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [snapshot, setSnapshot] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/settings/backup/history", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Riwayat cadangan gagal dimuat.");
        return response.json() as Promise<{ snapshots: BackupRecord[] }>;
      }).then(({ snapshots }) => {
        if (!active) return;
        setHistory(snapshots);
        if (snapshots.length) setSnapshot(snapshots[0].name);
      }).catch(() => {
        if (active) setError("Riwayat cadangan gagal dimuat.");
      });
    return () => { active = false; };
  }, []);

  function chooseSnapshot(value: string) {
    setSnapshot(value);
    setPreview(null);
    setConfirmation("");
    setMessage("");
    setError("");
  }

  async function inspect() {
    if (!snapshot) return;
    setPending(true); setError(""); setMessage(""); setPreview(null);
    setConfirmation("");
    try {
      const response = await fetch("/api/settings/restore/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pratinjau gagal.");
      setPreview(data as Preview);
      setMessage("Pratinjau berhasil. Belum ada perubahan data.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pratinjau gagal.");
    } finally {
      setPending(false);
    }
  }

  async function apply() {
    if (!preview?.eligibleForAtomicRestore || confirmation !== CONFIRMATION || !snapshot) return;
    setPending(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/settings/restore/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Budgetku-Restore-Intent": "staging-v1-confirmed",
        },
        body: JSON.stringify({
          snapshot,
          expectedBackupSha256: preview.backupSha256,
          expectedCurrentSha256: preview.currentSha256,
          confirmation,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const blockers = Array.isArray(data.blockers) ? " " + data.blockers.join("; ") : "";
        throw new Error((data.error || "Restore dibatalkan.") + blockers);
      }
      setMessage("Restore staging berhasil. Cadangan pengaman: " + data.safetySnapshot);
      setPreview(null);
      setConfirmation("");
      router.refresh();
      const historyResponse = await fetch("/api/settings/backup/history", { cache: "no-store" });
      if (historyResponse.ok) {
        const latest = (await historyResponse.json()) as { snapshots: BackupRecord[] };
        setHistory(latest.snapshots);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Restore gagal.");
      setPreview(null); setConfirmation("");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="restore-title" className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-1">
        <h3 id="restore-title" className="text-body-md font-semibold text-on-surface">Simulasi pemulihan (staging)</h3>
        <p className="text-body-sm text-on-surface-variant">
          Pengujian di database terpisah. Pilih cadangan bertanggal, periksa
          seluruh perubahan, lalu konfirmasi secara eksplisit. Tidak digunakan di aplikasi production.
        </p>
      </div>
      <label htmlFor="restore-snapshot" className="text-body-sm font-medium text-on-surface">
        Cadangan yang akan dipulihkan
      </label>
      <select
        id="restore-snapshot"
        className="min-h-11 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface"
        value={snapshot}
        onChange={(e) => chooseSnapshot(e.target.value)}
        disabled={pending || !history.length}
      >
        {!history.length ? <option value="">Belum ada cadangan bertanggal</option> : null}
        {history.map((item) => (
          <option key={item.name} value={item.name}>
            {formatDate(item.createdAt)} WIB — {item.name.slice(-18)}
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" className="h-11" disabled={pending || !snapshot} onClick={inspect}>
        {pending ? "Memeriksa..." : "Periksa dampak Restore"}
      </Button>
      {preview ? (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-on-surface-variant">
            Cadangan dibuat {formatDate(preview.backupGeneratedAt)} WIB.
            {preview.externalGmailLinks > 0 ? " Transaksi yang terhubung dengan impor Gmail: " + preview.externalGmailLinks + "." : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead><tr className="border-b border-outline-variant">
                <th className="py-2 pr-2">Data</th>
                <th className="px-1 py-2 text-right">Tambah</th>
                <th className="px-1 py-2 text-right">Ubah</th>
                <th className="py-2 pl-1 text-right">Hapus</th>
              </tr></thead>
              <tbody>{Object.entries(preview.tables).map(([key, counts]) => (
                <tr key={key} className="border-b border-outline-variant/60">
                  <td className="py-2 pr-2">{LABELS[key] ?? key}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{counts.wouldAdd}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{counts.wouldUpdate}</td>
                  <td className="py-2 pl-1 text-right tabular-nums">{counts.wouldRemove}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {preview.blockers.length ? (
            <div role="alert" className="text-body-sm text-expense">
              <strong>Pemulihan diblokir:</strong>
              <ul className="ml-4 list-disc">{preview.blockers.map((text, index) => <li key={index}>{text}</li>)}</ul>
            </div>
          ) : (
            <>
              <p className="text-body-sm font-medium text-expense">
                Perhatian: data di kolom Hapus akan hilang dari keadaan aktif.
                Sistem menyimpan cadangan pengaman sebelum pemulihan.
              </p>
              <label htmlFor="restore-confirm" className="text-body-sm text-on-surface">
                Untuk menyetujui pemulihan, ketik <strong>{CONFIRMATION}</strong>:
              </label>
              <input
                id="restore-confirm"
                className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface"
                autoComplete="off" spellCheck={false} value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)} disabled={pending}
              />
              <Button
                type="button" variant="destructive" className="h-11"
                disabled={pending || confirmation !== CONFIRMATION || !preview.eligibleForAtomicRestore}
                onClick={apply}
              >
                {pending ? "Memulihkan..." : "Pulihkan data staging"}
              </Button>
            </>
          )}
        </div>
      ) : null}
      {message ? <p role="status" aria-live="polite" className="text-body-sm text-on-surface-variant break-words">{message}</p> : null}
      {error ? <p role="alert" className="text-body-sm text-expense break-words">{error}</p> : null}
    </section>
  );
}
