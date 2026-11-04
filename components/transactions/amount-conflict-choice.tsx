"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type AmountConflict = {
  id: string;
  currentAmount: number;
  savedAmount: number;
  currentUpdatedAt: string;
  transactionType: string;
  merchant: string | null;
  description: string | null;
  transactionAt: string;
  createdAt: string;
  snapshot: string;
  backupSha256: string;
  journalEventId?: number;
};

const CONFIRM = "GUNAKAN VERSI CADANGAN";
const amount = (n: number) => "Rp " + n.toLocaleString("id-ID");
const nameOf = (row: AmountConflict) => row.merchant || row.description ||
  (row.transactionType === "income" ? "Pemasukan" :
   row.transactionType === "transfer" ? "Transfer" : "Pengeluaran");

function Choice({
  row, currentHash, enabled, onApplied,
}: {
  row: AmountConflict;
  currentHash: string;
  enabled: boolean;
  onApplied: () => void;
}) {
  // Default is NEVER to modify the live transaction.
  const [choice, setChoice] = useState<"current" | "saved">("current");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function apply() {
    if (choice !== "saved" || !enabled || pending || confirm !== CONFIRM) return;
    setPending(true);
    setError("");
    try {
      const source = row.journalEventId
        ? { journalEventId: row.journalEventId }
        : { snapshot: row.snapshot, backupSha256: row.backupSha256 };
      const response = await fetch("/api/transactions/recovery/conflict", {
        method: "POST", cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Budgetku-Smart-Restore-Intent": "budgetku-smart-restore-v1",
        },
        body: JSON.stringify({
          id: row.id, source, expectedCurrentSha256: currentHash,
          confirmation: confirm,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const reason = data && typeof data === "object" && "error" in data
          ? (data as { error: unknown }).error : null;
        throw new Error(typeof reason === "string" ? reason : "Pilihan versi tidak berhasil.");
      }
      if (!data || typeof data !== "object" ||
        !("ok" in data) || data.ok !== true) {
        throw new Error("Hasil pemulihan belum bisa dipastikan.");
      }
      setNotice("Nilai versi cadangan berhasil digunakan.");
      onApplied();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pemulihan nominal gagal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <p className="text-body-md font-semibold text-on-surface">{nameOf(row)}</p>
      <p className="mt-1 text-label-sm text-on-surface-variant">
        ID transaksi sama, tetapi nominalnya berbeda.
      </p>
      <fieldset disabled={!enabled || pending} className="mt-3 flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-medium text-on-surface">
          Nominal mana yang mau digunakan?
        </legend>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-outline-variant p-3">
          <input type="radio" name={"amount-choice-" + row.id} value="current"
            checked={choice === "current"} onChange={() => {
              setChoice("current"); setConfirm(""); setError("");
            }} className="size-5 accent-primary" />
          <span className="flex flex-1 flex-col">
            <span className="text-body-sm font-semibold text-on-surface">Pertahankan data sekarang</span>
            <span className="text-body-sm tabular-nums text-on-surface-variant">{amount(row.currentAmount)}</span>
          </span>
        </label>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-outline-variant p-3">
          <input type="radio" name={"amount-choice-" + row.id} value="saved"
            checked={choice === "saved"} onChange={() => {
              setChoice("saved"); setConfirm(""); setError("");
            }} className="size-5 accent-primary" />
          <span className="flex flex-1 flex-col">
            <span className="text-body-sm font-semibold text-on-surface">Gunakan versi cadangan</span>
            <span className="text-body-sm tabular-nums text-on-surface-variant">{amount(row.savedAmount)}</span>
          </span>
        </label>
      </fieldset>
      {choice === "saved" ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-body-sm text-on-surface-variant">
            Nominal transaksi akan diubah dari {amount(row.currentAmount)} menjadi{" "}
            {amount(row.savedAmount)}. Rekening, kategori, dan catatan tidak diubah.
            Riwayat perubahan tetap tersimpan selama 30 hari.
          </p>
          <label htmlFor={"amount-confirm-" + row.id} className="text-body-sm font-medium text-on-surface">
            Ketik {CONFIRM} untuk mengonfirmasi perubahan saldo
          </label>
          <input id={"amount-confirm-" + row.id} value={confirm}
            onChange={event => setConfirm(event.target.value)}
            autoComplete="off" spellCheck={false} disabled={!enabled || pending}
            className="min-h-11 rounded-lg border border-input bg-surface-container-lowest px-3 text-body-sm" />
          <Button type="button" disabled={!enabled || pending || confirm !== CONFIRM}
            onClick={() => void apply()} className="min-h-11">
            {pending ? "Menyimpan pilihan..." : "Gunakan nominal dari cadangan"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-label-sm text-on-surface-variant">
          Pilihan aman: tidak ada perubahan. Lo tidak perlu menekan tombol apa pun.
        </p>
      )}
      {error ? <p role="alert" className="mt-2 text-body-sm text-expense">{error}</p> : null}
      {notice ? <p role="status" className="mt-2 text-body-sm">{notice}</p> : null}
    </div>
  );
}

export function AmountConflictChoices({
  conflicts, currentHash, enabled, onApplied,
}: {
  conflicts: AmountConflict[];
  currentHash: string;
  enabled: boolean;
  onApplied: () => void;
}) {
  if (conflicts.length === 0) return null;
  return (
    <section aria-label="Versi transaksi berbeda" className="flex flex-col gap-3">
      <div>
        <h3 className="text-title-md font-semibold text-on-surface">Versi transaksi berbeda</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Budgetku menemukan nominal berbeda untuk transaksi yang sama.
          Data yang sekarang tetap dipakai kecuali lo memilih versi cadangan.
        </p>
      </div>
      {conflicts.map(row => <Choice key={row.id} row={row}
        currentHash={currentHash} enabled={enabled} onApplied={onApplied} />)}
    </section>
  );
}
