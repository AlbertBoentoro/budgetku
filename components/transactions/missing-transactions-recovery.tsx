"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { selectedRestoreImpact } from "@/lib/settings/smart-restore-plan.mjs";

type RecoveryCandidate = {
  id: string; snapshot: string; backupSha256: string; fingerprint: string;
  createdAt: string | null; transactionAt: string;
  amount: number; transactionType: string;
  merchant: string | null; description: string | null;
  accountId: string; accountName: string;
  destinationAccountId: string | null; destinationAccountName: string | null;
  categoryName: string | null; eligible: boolean; reason: string | null;
};
type SearchPage = {
  candidates: RecoveryCandidate[];
  scanned: number; skipped: number; currentSha256: string;
  anchor: string | null; nextOffset: number | null; truncated: boolean;
};
const CONFIRMATION = "PULIHKAN TRANSAKSI";
const MAX_ROWS = 50;
const MAX_BACKUPS = 10;
const money = (n: number) => (n < 0 ? "−" : n > 0 ? "+" : "") +
  "Rp" + Math.abs(n).toLocaleString("id-ID");
const moment = (value: string | null) => {
  if (!value) return "Tidak diketahui";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Tidak diketahui";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Jakarta",
  }).format(date) + " WIB";
};
const summary = (row: RecoveryCandidate) => row.merchant || row.description ||
  (row.transactionType === "income" ? "Pemasukan" :
    row.transactionType === "transfer" ? "Transfer" : "Pengeluaran");
const signedAmount = (row: RecoveryCandidate) =>
  row.transactionType === "income" ? row.amount :
    row.transactionType === "expense" ? -row.amount : -row.amount;

/** Merge identical IDs across overlapping snapshots, preserve the newest
 * verified copy, and quarantine conflicting histories rather than choosing
 * a potentially incorrect amount silently.
 */
function combine(previous: RecoveryCandidate[], next: RecoveryCandidate[]) {
  const byId = new Map(previous.map(row => [row.id, row]));
  for (const row of next) {
    const found = byId.get(row.id);
    if (!found) {
      byId.set(row.id, row);
      continue;
    }
    if (found.fingerprint !== row.fingerprint) {
      byId.set(row.id, {
        ...found, eligible: false,
        reason: "Detail transaksi berbeda antarversi cadangan. Perlu pemeriksaan manual.",
      });
    }
  }
  return [...byId.values()].sort((a, b) =>
    (b.createdAt ?? b.transactionAt).localeCompare(a.createdAt ?? a.transactionAt));
}

export function MissingTransactionsRecovery() {
  const router = useRouter();
  const controllerRef = useRef<AbortController | null>(null);
  const [scanning, setScanning] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [rows, setRows] = useState<RecoveryCandidate[]>([]);
  const [currentHash, setCurrentHash] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [completeRestore, setCompleteRestore] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function scan(controller: AbortController) {
    setScanning(true);
    setCompleted(false);
    setIncomplete(false);
    setRows([]);
    setSelected([]);
    setReview(false);
    setCurrentHash("");
    setConfirmation("");
    setCompleteRestore(false);
    setMessage("");
    setError("");
    setScanned(0);
    setSkipped(0);
    let offset = 0, anchor: string | null = null, sha: string | null = null;
    try {
      for (;;) {
        const response = await fetch("/api/settings/restore/search", {
          method: "POST", cache: "no-store", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, anchor }),
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const reason = payload && typeof payload === "object" && "error" in payload
            ? (payload as { error: unknown }).error : null;
          throw new Error(typeof reason === "string" ? reason : "Pencarian gagal.");
        }
        if (!payload || typeof payload !== "object" || !("candidates" in payload) ||
          !Array.isArray(payload.candidates) ||
          !("currentSha256" in payload) || typeof payload.currentSha256 !== "string" ||
          !("scanned" in payload) || typeof payload.scanned !== "number" ||
          !("skipped" in payload) || typeof payload.skipped !== "number" ||
          !("nextOffset" in payload) ||
          (payload.nextOffset !== null && typeof payload.nextOffset !== "number") ||
          !("anchor" in payload) || !("truncated" in payload)) {
          throw new Error("Respons pencarian tidak valid.");
        }
        const page = payload as SearchPage;
        if (sha && sha !== page.currentSha256) {
          throw new Error("Data berubah selama pencarian. Jalankan ulang agar hasilnya akurat.");
        }
        sha = page.currentSha256;
        if (controller.signal.aborted) return;
        setCurrentHash(page.currentSha256);
        setRows(old => combine(old, page.candidates));
        setScanned(v => v + page.scanned);
        setSkipped(v => v + page.skipped);
        setIncomplete(page.truncated);
        if (page.nextOffset === null) break;
        if (!page.anchor || page.nextOffset <= offset) {
          throw new Error("Urutan backup tidak konsisten. Jalankan ulang.");
        }
        offset = page.nextOffset;
        anchor = page.anchor;
      }
      if (!controller.signal.aborted) setCompleted(true);
    } catch (cause) {
      if (!controller.signal.aborted) setError(
        cause instanceof Error ? cause.message : "Pencarian gagal.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setScanning(false);
      }
    }
  }

  function restart() {
    if (pending) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    void scan(controller);
  }

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    void scan(controller);
    return () => controller.abort();
  }, []);

  const byId = new Map(rows.map(r => [r.id, r]));
  const picked = selected.map(id => byId.get(id)).filter(
    (row): row is RecoveryCandidate => Boolean(row?.eligible));
  const eligible = rows.filter(row => row.eligible);
  const matched = rows.filter(row => {
    const text = [summary(row), row.description, row.categoryName, row.accountName,
      row.createdAt ? moment(row.createdAt) : "", moment(row.transactionAt)].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const impact = picked.length <= MAX_ROWS
    ? selectedRestoreImpact(picked, picked.map(r => r.id))
    : { count: picked.length, accountChanges: [] };
  const sources = new Set(picked.map(r => r.snapshot));
  // Never permit a financial restore based on a partial history scan.
  // A later or unverifiable snapshot could contain a conflicting version.
  const canRestore = completed && !scanning && !pending && !completeRestore &&
    !incomplete && skipped === 0 && !error &&
    picked.length > 0 && picked.length <= MAX_ROWS && sources.size <= MAX_BACKUPS;

  function toggle(row: RecoveryCandidate, checked: boolean) {
    if (scanning || pending || completeRestore || !row.eligible) return;
    setSelected(old => checked
      ? old.includes(row.id) ? old : [...old, row.id]
      : old.filter(id => id !== row.id));
    setReview(false);
    setConfirmation("");
    setError("");
  }

  async function apply() {
    if (!canRestore || !review || confirmation !== CONFIRMATION) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/transactions/recovery/apply", {
        method: "POST", cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Budgetku-Smart-Restore-Intent": "budgetku-smart-restore-v1",
        },
        body: JSON.stringify({
          selections: picked.map(row => ({
            id: row.id, snapshot: row.snapshot, backupSha256: row.backupSha256,
          })),
          expectedCurrentSha256: currentHash,
          confirmation,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const reason = result && typeof result === "object" && "error" in result
          ? (result as { error: unknown }).error : null;
        throw new Error(typeof reason === "string" ? reason : "Pemulihan ditolak.");
      }
      if (!result || typeof result !== "object" || !("restoredCount" in result) ||
        result.restoredCount !== picked.length) {
        throw new Error("Hasil pemulihan perlu diverifikasi.");
      }
      setCompleteRestore(true);
      setReview(false);
      setConfirmation("");
      setMessage(picked.length + " transaksi berhasil dipulihkan. Transaksi lainnya dipertahankan.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pemulihan gagal.");
      setReview(false);
      setConfirmation("");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="recovery-title">
      <div className="flex flex-col gap-1">
        <h2 id="recovery-title" className="text-title-md font-semibold text-on-surface">
          Transaksi terdeteksi hilang
        </h2>
        <p className="text-body-sm text-on-surface-variant">
          Transaksi ini tercatat pada cadangan lama, tetapi sekarang tidak ada
          di daftar transaksi. Termasuk transaksi yang mungkin sengaja dihapus.
          Transaksi yang tidak pernah dicadangkan tidak bisa ditemukan.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-body-sm text-on-surface-variant">
          {scanning ? "Memeriksa riwayat..." : completed ? "Pencarian selesai" : "Pencarian belum lengkap"}
          {" · "}{scanned} cadangan diperiksa
          {skipped > 0 ? " · " + skipped + " file gagal diverifikasi" : ""}
        </p>
        <Button type="button" variant="outline" disabled={scanning || pending}
          onClick={restart}>Periksa ulang</Button>
      </div>
      {scanning ? <p className="text-body-sm text-on-surface-variant">
        Pencarian dilakukan bertahap untuk menghindari timeout. Tidak ada data yang diubah.
      </p> : null}
      {skipped > 0 || incomplete ? (
        <p role="alert" className="text-body-sm text-expense">
          Beberapa cadangan belum diperiksa sepenuhnya.
          {skipped > 0 ? " Ada file yang gagal diverifikasi." : ""}
          {incomplete ? " Batas 500 cadangan tercapai." : ""}
          Hasil ini belum tentu mencakup semua transaksi yang hilang.
          Pemulihan dinonaktifkan sampai seluruh riwayat berhasil diperiksa.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-body-sm text-expense">{error}</p> : null}
      {rows.length > 0 ? (
        <>
          <p className="text-body-sm font-medium text-on-surface">
            {rows.length} transaksi unik terdeteksi · {eligible.length} dapat dipulihkan
          </p>
          <label className="flex flex-col gap-1 text-body-sm text-on-surface" htmlFor="recovery-search">
            Cari transaksi berdasarkan keterangan atau tanggal
            <input id="recovery-search" value={query} onChange={e => setQuery(e.target.value)}
              type="search" placeholder="Contoh: belanja, 3 Nov 2026"
              className="min-h-11 w-full rounded-lg border border-input bg-surface-container-lowest px-3 text-body-sm"/>
          </label>
          <div className="flex flex-col divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest px-3">
            {matched.map(row => (
              <label key={row.id} className="flex items-start gap-3 py-4">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary"
                  checked={selected.includes(row.id)}
                  disabled={scanning || pending || completeRestore || !row.eligible}
                  onChange={event => toggle(row, event.target.checked)}
                  aria-label={"Pulihkan " + summary(row) + " " + money(row.amount)} />
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="flex justify-between gap-2">
                    <span className="break-words text-body-sm font-medium text-on-surface">{summary(row)}</span>
                    <span className="shrink-0 text-body-sm font-semibold tabular-nums text-on-surface">
                      {money(signedAmount(row))}
                    </span>
                  </span>
                  <span className="text-label-xs text-on-surface-variant">
                    {row.accountName}{row.categoryName ? " · " + row.categoryName : ""}
                    {row.destinationAccountName ? " → " + row.destinationAccountName : ""}
                  </span>
                  <span className="text-label-xs text-on-surface-variant">
                    <strong>Dibuat:</strong> {moment(row.createdAt)}
                  </span>
                  <span className="text-label-xs text-on-surface-variant">
                    <strong>Tanggal transaksi:</strong> {moment(row.transactionAt)}
                  </span>
                  {row.reason ? (
                    <span className="text-label-xs text-expense">{row.reason}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </>
      ) : completed && skipped === 0 && !incomplete ? (
        <p role="status" className="text-body-sm text-on-surface-variant">
          Tidak ada transaksi hilang yang terdeteksi di cadangan yang tersedia.
        </p>
      ) : null}
      {completeRestore ? (
        <div role="status" className="rounded-lg border border-outline-variant p-3">
          <p className="text-body-sm text-on-surface">{message}</p>
          <Button type="button" variant="outline" className="mt-3"
            onClick={restart}>Periksa kembali transaksi yang belum ada</Button>
        </div>
      ) : selected.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-body-sm font-semibold text-on-surface">
            {selected.length} transaksi dipilih (maksimal {MAX_ROWS})
          </p>
          {picked.length > MAX_ROWS || sources.size > MAX_BACKUPS ? (
            <p role="alert" className="text-body-sm text-expense">
              Untuk satu pemulihan, pilih maksimal {MAX_ROWS} transaksi dari {MAX_BACKUPS}
              sumber cadangan. Bagi menjadi beberapa kelompok bila perlu.
            </p>
          ) : null}
          {review ? (
            <>
              <h3 className="text-body-sm font-semibold text-on-surface">Periksa dampak pemulihan</h3>
              <p className="text-body-sm text-on-surface-variant">
                {picked.length} transaksi akan ditambahkan kembali secara atomik.
                Transaksi yang sudah ada tidak akan dihapus atau ditimpa.
              </p>
              {impact.accountChanges.map(a => (
                <div key={a.accountId} className="flex justify-between gap-2 text-body-sm">
                  <span>{a.name}</span><span className="font-semibold tabular-nums">{money(a.delta)}</span>
                </div>
              ))}
              <p className="text-body-sm text-on-surface-variant">
                Sebelum pemulihan, Budgetku menyimpan cadangan pengaman.
                Bila saldo atau transaksi berubah selama pemeriksaan, pemulihan akan ditolak.
              </p>
              <label htmlFor="recovery-confirm" className="text-body-sm font-medium text-on-surface">
                Ketik {CONFIRMATION} untuk mengonfirmasi
              </label>
              <input id="recovery-confirm" value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                disabled={pending} autoComplete="off" spellCheck={false}
                className="min-h-11 w-full rounded-lg border border-input bg-surface-container-lowest px-3 text-body-sm"/>
              <Button type="button" className="min-h-11" disabled={!canRestore || confirmation !== CONFIRMATION}
                onClick={() => void apply()}>
                {pending ? "Memulihkan..." : "Pulihkan " + picked.length + " transaksi"}
              </Button>
              <Button type="button" variant="outline" disabled={pending}
                onClick={() => { setReview(false); setConfirmation(""); }}>
                Kembali memilih
              </Button>
            </>
          ) : (
            <Button type="button" className="min-h-11"
              disabled={!canRestore} onClick={() => setReview(true)}>
              Lihat dampak {picked.length} transaksi terpilih
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
