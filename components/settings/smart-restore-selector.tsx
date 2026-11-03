"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { selectedRestoreImpact } from "@/lib/settings/smart-restore-plan.mjs";

type Candidate = {
  id: string; amount: number; transactionType: string; transactionAt: string;
  merchant: string | null; description: string | null;
  accountId: string; accountName: string;
  destinationAccountId: string | null; destinationAccountName: string | null;
  categoryName: string | null; eligible: boolean; reason: string | null;
};
export type SmartRestorePreview = {
  candidates: Candidate[]; alreadyPresent: number; eligibleCount: number;
  blockedCount: number; defaultSelectedIds: string[];
};
const CONFIRMATION = "PULIHKAN TRANSAKSI";
const rupiah = (value: number) =>
  (value < 0 ? "−" : value > 0 ? "+" : "") + "Rp" +
  Math.abs(value).toLocaleString("id-ID");
const dateText = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short",
      year: "numeric", timeZone: "Asia/Jakarta" }).format(date)
    : "Tanggal tidak valid";
};
const label = (value: Candidate) => value.merchant || value.description ||
  (value.transactionType === "income" ? "Pemasukan" :
    value.transactionType === "transfer" ? "Transfer" : "Pengeluaran");

export function SmartRestoreSelector({
  snapshot, backupSha256, currentSha256, plan,
}: {
  snapshot: string; backupSha256: string; currentSha256: string;
  plan: SmartRestorePreview;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const eligible = plan.candidates.filter(row => row.eligible);
  const impact = selectedRestoreImpact(plan.candidates, selected);

  const choose = (id: string, checked: boolean) => {
    setSelected(previous => checked ? [...previous, id] : previous.filter(value => value !== id));
    setReview(false);
    setConfirmation("");
    setError("");
  };
  async function apply() {
    if (!review || confirmation !== CONFIRMATION || selected.length === 0 ||
      pending || complete) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/settings/restore/smart/apply", {
        method: "POST", cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Budgetku-Smart-Restore-Intent": "budgetku-smart-restore-v1",
        },
        body: JSON.stringify({
          snapshot, selectedIds: selected,
          expectedBackupSha256: backupSha256,
          expectedCurrentSha256: currentSha256,
          confirmation,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const reason = payload && typeof payload === "object" && "error" in payload
          ? (payload as { error: unknown }).error : null;
        throw new Error(typeof reason === "string" ? reason : "Pemulihan ditolak.");
      }
      if (!payload || typeof payload !== "object" || !("restoredCount" in payload) ||
        payload.restoredCount !== selected.length) {
        throw new Error("Jumlah transaksi perlu diverifikasi kembali.");
      }
      setComplete(true);
      setMessage(selected.length + " transaksi dikembalikan di staging. Data lainnya dipertahankan.");
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pemulihan gagal.");
      setReview(false);
      setConfirmation("");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="smart-restore-heading"
      className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex flex-col gap-1">
        <h4 id="smart-restore-heading" className="text-body-md font-semibold text-on-surface">
          Pulihkan transaksi tertentu
        </h4>
        <p className="text-body-sm text-on-surface-variant">
          Pilih transaksi yang tidak ada di data sekarang. Transaksi terbaru tidak akan
          dihapus. Semua pilihan kosong secara default.
        </p>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        {plan.eligibleCount} bisa dipulihkan · {plan.blockedCount} perlu pemeriksaan lain
      </p>
      {plan.candidates.length === 0 ? (
        <p role="status" className="text-body-sm text-on-surface-variant">
          Tidak ada transaksi yang hilang dari cadangan ini.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-outline-variant">
          {plan.candidates.map(row => (
            <label key={row.id} className="flex items-start gap-3 py-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary"
                aria-label={"Pulihkan " + label(row) + " " + dateText(row.transactionAt)}
                checked={selected.includes(row.id)} disabled={!row.eligible || pending || complete}
                onChange={event => choose(row.id, event.target.checked)}/>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="break-words text-body-sm font-medium text-on-surface">
                    {label(row)}
                  </span>
                  <span className="shrink-0 text-body-sm tabular-nums text-on-surface">
                    {rupiah(row.transactionType === "income" ? row.amount : -row.amount)}
                  </span>
                </span>
                <span className="text-label-xs text-on-surface-variant">
                  {dateText(row.transactionAt)} · {row.accountName}
                  {row.categoryName ? " · " + row.categoryName : ""}
                </span>
                {row.reason ? (
                  <span className="text-label-xs text-expense">{row.reason}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
      {eligible.length > 0 && !complete ? (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-on-surface">
            {selected.length} dari {eligible.length} transaksi dipilih
          </p>
          {review ? (
            <div className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
              <p className="text-body-sm font-semibold text-on-surface">
                Periksa sebelum memulihkan
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {selected.length} transaksi terpilih akan ditambahkan kembali.
                Transaksi yang sudah ada tidak diubah atau dihapus.
              </p>
              {impact.accountChanges.map(account => (
                <div key={account.accountId} className="flex justify-between gap-2 text-body-sm">
                  <span className="text-on-surface">{account.name}</span>
                  <span className="tabular-nums font-medium text-on-surface">
                    {rupiah(account.delta)}
                  </span>
                </div>
              ))}
              <p className="text-body-sm text-on-surface-variant">
                Cadangan pengaman kondisi saat ini dibuat sebelum pemulihan.
                Jika data berubah sejak pemeriksaan, sistem membatalkannya.
              </p>
              <label htmlFor="smart-restore-confirm"
                className="text-body-sm font-medium text-on-surface">
                Ketik {CONFIRMATION} untuk melanjutkan
              </label>
              <input id="smart-restore-confirm" value={confirmation}
                autoComplete="off" spellCheck={false} disabled={pending}
                onChange={event => setConfirmation(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-input bg-surface-container-lowest px-3 text-body-sm text-on-surface"/>
              <Button type="button" className="min-h-11" onClick={() => void apply()}
                disabled={pending || confirmation !== CONFIRMATION}>
                {pending ? "Memulihkan..." : "Pulihkan " + selected.length + " transaksi"}
              </Button>
              <Button type="button" variant="outline" className="min-h-11"
                disabled={pending} onClick={() => {setReview(false);setConfirmation("");}}>
                Kembali memilih
              </Button>
            </div>
          ) : (
            <Button type="button" className="min-h-11" disabled={selected.length===0}
              onClick={() => setReview(true)}>
              Lihat dampak {selected.length} transaksi terpilih
            </Button>
          )}
        </div>
      ) : null}
      {message ? <p role="status" aria-live="polite" className="text-body-sm text-on-surface">
        {message}
      </p> : null}
      {error ? <p role="alert" className="text-body-sm text-expense">{error}</p> : null}
    </section>
  );
}
