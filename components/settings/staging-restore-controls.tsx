"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Snapshot = { name: string; createdAt: string | null; size: number | null };
type Preview = {
  ok: true;
  snapshot: string;
  sha256: string;
  generatedAt: string;
  counts: Record<string, number>;
};

const labels: Record<string, string> = {
  accounts: "Rekening", categories: "Kategori", budgets: "Anggaran",
  budgetItems: "Pos anggaran", transactions: "Transaksi",
  recurringTransactions: "Transaksi berulang",
  financialGoals: "Target tabungan", goalContributions: "Setoran tabungan",
  merchantRules: "Aturan merchant",
};

export function StagingRestoreControls() {
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetch("/api/settings/backup/history", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Riwayat cadangan tidak tersedia.");
        return await res.json() as { snapshots: Snapshot[] };
      })
      .then((data) => {
        if (!alive) return;
        setHistory(data.snapshots);
        setSelected(data.snapshots[0]?.name ?? "");
      })
      .catch(() => { if (alive) setMessage("Riwayat cadangan gagal dimuat."); });
    return () => { alive = false; };
  }, []);

  async function postRestore(mode: "preview" | "apply") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, snapshot: selected,
          ...(mode === "apply" && preview
            ? { sha256: preview.sha256, confirmation }
            : {}),
        }),
      });
      const result = await response.json() as {
        ok: boolean; message?: string; sha256?: string;
        counts?: Record<string, number>; generatedAt?: string;
      };
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "Permintaan pemulihan gagal.");
        return;
      }
      if (mode === "preview") {
        if (!result.sha256 || !result.counts || !result.generatedAt) {
          throw new Error("Respons pratinjau tidak lengkap.");
        }
        setPreview({
          ok: true, snapshot: selected, sha256: result.sha256,
          generatedAt: result.generatedAt, counts: result.counts,
        });
      } else {
        setPreview(null);
        setConfirmation("");
        setMessage(result.message ?? "Pemulihan berhasil.");
        router.refresh();
      }
    } catch {
      setMessage("Koneksi terputus atau permintaan tidak berhasil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="font-semibold text-on-surface">Pemulihan data (staging)</h3>
      <p className="text-body-sm text-on-surface-variant">
        Hanya untuk pengujian. Pemulihan mengganti rekening, transaksi, anggaran,
        kategori pribadi, dan target ke keadaan backup terpilih. Catatan Gmail
        yang belum tercakup backup tidak akan dihapus.
      </p>
      <label htmlFor="restore-snapshot" className="text-body-sm font-medium">
        Versi cadangan
      </label>
      <select
        id="restore-snapshot"
        className="h-11 rounded-md border border-outline-variant bg-transparent px-3"
        value={selected}
        onChange={(event) => {
          setSelected(event.target.value);
          setPreview(null);
          setConfirmation("");
        }}
      >
        {history.length === 0 && <option value="">Belum ada versi tersimpan</option>}
        {history.map((item) => (
          <option key={item.name} value={item.name}>
            {item.createdAt
              ? new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
                }).format(new Date(item.createdAt))
              : item.name}
          </option>
        ))}
      </select>
      <Button
        type="button" variant="outline" disabled={!selected || busy}
        onClick={() => postRestore("preview")}
      >
        {busy ? "Memeriksa..." : "Periksa isi cadangan"}
      </Button>
      {preview && (
        <div className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
          <p className="text-body-sm font-medium">
            Cadangan valid, dibuat {new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
            }).format(new Date(preview.generatedAt))} WIB
          </p>
          <dl className="grid grid-cols-2 gap-2 text-body-sm">
            {Object.entries(preview.counts).map(([key, count]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt>{labels[key] ?? key}</dt>
                <dd className="font-semibold">{count}</dd>
              </div>
            ))}
          </dl>
          <label htmlFor="restore-confirm" className="text-body-sm">
            Ketik <strong>PULIHKAN</strong> untuk melanjutkan
          </label>
          <input
            id="restore-confirm" value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="h-11 rounded-md border border-outline-variant bg-transparent px-3"
          />
          <Button
            type="button" disabled={busy || confirmation !== "PULIHKAN"}
            onClick={() => postRestore("apply")}
          >
            {busy ? "Memulihkan..." : "Pulihkan versi ini"}
          </Button>
        </div>
      )}
      {message && <p role="status" aria-live="polite" className="text-body-sm">{message}</p>}
    </div>
  );
}
