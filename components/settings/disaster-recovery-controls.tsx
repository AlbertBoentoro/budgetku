"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type Source = "cloud" | "file";
type Snapshot = { name: string; createdAt: string; size: number | null };
type TableCount = { current: number; backup: number; wouldAdd: number;
  wouldUpdate: number; wouldRemove: number };
type Preview = {
  previewOnly: true; generatedAt: string; currentSha256: string;
  backupSha256: string; canRestore: boolean; missingCount: number;
  protectedConflicts: number; protectedNewerRows: number;
  blockers: string[]; tables: Record<string, TableCount>;
};
const CONFIRM = "PULIHKAN DATA";
const MAX_FILE = 10 * 1024 * 1024;
const LABELS: Record<string,string> = {
  accounts:"Rekening",categories:"Kategori",transactions:"Transaksi",
  budgets:"Anggaran",budgetItems:"Pos anggaran",
  recurringTransactions:"Transaksi berulang",financialGoals:"Tujuan keuangan",
  goalContributions:"Kontribusi tujuan",merchantRules:"Aturan merchant",
};
const date = (value: string) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("id-ID",{
    dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta",
  }).format(d)+" WIB" : "Tanggal tidak tersedia";
};
function readError(value: unknown) {
  return value && typeof value === "object" && "error" in value &&
    typeof value.error === "string" ? value.error : "Permintaan gagal.";
}

export function DisasterRecoveryControls() {
  const router = useRouter();
  const [source,setSource] = useState<Source>("cloud");
  const [snapshots,setSnapshots] = useState<Snapshot[]>([]);
  const [snapshot,setSnapshot] = useState("");
  const [file,setFile] = useState<File | null>(null);
  const [loading,setLoading] = useState(true);
  const [pending,setPending] = useState(false);
  const [preview,setPreview] = useState<Preview | null>(null);
  const [confirmation,setConfirmation] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/settings/backup/history",{
          signal:controller.signal,cache:"no-store",
        });
        if (!response.ok) throw new Error("Daftar cadangan belum bisa dimuat.");
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" ||
            !("snapshots" in body) || !Array.isArray(body.snapshots)) {
          throw new Error("Daftar cadangan tidak valid.");
        }
        const entries = (body.snapshots as Snapshot[]).filter(item =>
          typeof item.name === "string" && typeof item.createdAt === "string");
        if (controller.signal.aborted) return;
        setSnapshots(entries);
        setSnapshot(entries[0]?.name ?? "");
      } catch (cause) {
        if (!controller.signal.aborted) setError(
          cause instanceof Error ? cause.message : "Daftar cadangan gagal dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  },[]);

  const reset = () => {
    setPreview(null);setConfirmation("");setNotice("");setError("");
  };
  function form(mode: "preview" | "apply") {
    const data = new FormData();
    data.append("mode",mode);
    data.append("source",source);
    if (source === "cloud") data.append("snapshot",snapshot);
    else if (file) data.append("file",file);
    if (mode === "apply" && preview) {
      data.append("expectedBackupSha256",preview.backupSha256);
      data.append("expectedCurrentSha256",preview.currentSha256);
      data.append("confirmation",confirmation);
    }
    return data;
  }

  async function request(mode:"preview"|"apply") {
    if (pending || (source === "cloud" && !snapshot) ||
        (source === "file" && (!file || file.size > MAX_FILE))) return;
    if (mode === "apply" &&
        (!preview?.canRestore || confirmation !== CONFIRM)) return;
    setPending(true);setError("");setNotice("");
    try {
      const response = await fetch("/api/settings/restore/rebuild",{
        method:"POST",cache:"no-store",
        headers:{"X-Budgetku-Restore-Intent":"budgetku-disaster-recovery-v1"},
        body:form(mode),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readError(result));
      if (!result || typeof result !== "object") {
        throw new Error("Respons pemulihan tidak valid.");
      }
      if (mode === "preview") {
        if (!("previewOnly" in result) || result.previewOnly !== true ||
            !("tables" in result) || !("backupSha256" in result)) {
          throw new Error("Hasil pemeriksaan tidak lengkap.");
        }
        setPreview(result as Preview);
      } else {
        if (!("ok" in result) || result.ok !== true) {
          throw new Error("Hasil pemulihan perlu diperiksa ulang.");
        }
        setPreview(null);setConfirmation("");
        setNotice("Data yang hilang berhasil dipulihkan. Data terbaru tetap dipertahankan.");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pemulihan gagal.");
      if (mode === "apply") {
        // A failed/stale restore must always be re-previewed, never retried
        // with a stored consent or a previously computed current-state hash.
        setPreview(null);setConfirmation("");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="disaster-recovery-title"
      className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div>
        <h3 id="disaster-recovery-title" className="text-body-md font-semibold text-on-surface">
          Pulihkan data yang hilang (darurat)
        </h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Pulihkan rekening, transaksi, anggaran, dan data keuangan lain yang
          hilang dari cadangan cloud atau file JSON Budgetku. Data sekarang
          tidak dihapus atau ditimpa.
        </p>
      </div>
      <fieldset disabled={pending} className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-on-surface">Sumber cadangan</legend>
        <label className="flex items-center gap-2 text-body-sm">
          <input type="radio" name="disaster-source" checked={source === "cloud"}
            onChange={() => {setSource("cloud");reset();}}
            className="size-4 accent-primary"/>Cadangan di cloud Budgetku
        </label>
        <label className="flex items-center gap-2 text-body-sm">
          <input type="radio" name="disaster-source" checked={source === "file"}
            onChange={() => {setSource("file");reset();}}
            className="size-4 accent-primary"/>File JSON dari perangkat
        </label>
      </fieldset>
      {source === "cloud" ? (
        <label className="flex flex-col gap-1 text-body-sm text-on-surface">
          Pilih cadangan cloud
          <select disabled={pending || loading} value={snapshot}
            onChange={e => {setSnapshot(e.target.value);reset();}}
            className="min-h-11 w-full rounded-lg border border-input bg-surface-container-lowest px-3">
            {snapshots.length === 0 ? (
              <option value="">{loading ? "Memuat cadangan..." : "Tidak ada cadangan tersedia"}</option>
            ) : snapshots.map((item,index) => (
              <option key={item.name} value={item.name}>
                {date(item.createdAt)}{index===0?" (terbaru)":""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-body-sm text-on-surface">
          Pilih file cadangan Budgetku (.json, maksimal 10 MB)
          <input type="file" accept=".json,application/json"
            disabled={pending}
            onChange={e => {setFile(e.target.files?.[0] ?? null);reset();}}
            className="min-h-11 w-full rounded-lg border border-input p-2"/>
        </label>
      )}
      <Button type="button" variant="outline" className="min-h-11"
        disabled={pending || (source === "cloud" ? !snapshot :
          !file || file.size > MAX_FILE)}
        onClick={() => void request("preview")}>
        <Icon name="search" size={18}/>
        {pending ? "Memeriksa..." : "Periksa cadangan sebelum memulihkan"}
      </Button>
      {preview ? (
        <div className="flex flex-col gap-3 border-t border-outline-variant pt-3">
          <p className="text-body-sm font-semibold">
            {preview.missingCount} data bisa ditambahkan dari cadangan
          </p>
          <p className="text-body-sm text-on-surface-variant">
            Cadangan dibuat {date(preview.generatedAt)}. Semua data yang
            sekarang masih ada akan dipertahankan.
          </p>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[290px] text-body-sm" aria-label="Hasil pemeriksaan pemulihan data">
              <thead><tr className="border-b border-outline-variant text-left">
                <th className="py-2">Jenis data</th>
                <th className="py-2 text-right">Dipulihkan</th>
                <th className="py-2 text-right">Dipertahankan</th>
              </tr></thead>
              <tbody>{Object.entries(preview.tables).map(([key,counts]) => (
                <tr key={key} className="border-b border-outline-variant/50">
                  <td className="py-2">{LABELS[key] ?? key}</td>
                  <td className="py-2 text-right tabular-nums">{counts.wouldAdd}</td>
                  <td className="py-2 text-right tabular-nums">
                    {counts.current}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {preview.protectedConflicts>0 ? (
            <p className="text-body-sm text-on-surface-variant">
              {preview.protectedConflicts} data memiliki versi berbeda.
              Versi saat ini tidak ditimpa. Untuk memilih nominal transaksi,
              buka <Link href="/transactions/recover" className="underline">Pulihkan transaksi</Link>.
            </p>
          ) : null}
          {preview.protectedNewerRows>0 ? (
            <p className="text-body-sm text-on-surface-variant">
              {preview.protectedNewerRows} data yang hanya ada sekarang tidak akan dihapus.
            </p>
          ) : null}
          {preview.blockers.length>0 ? (
            <div role="alert" className="text-body-sm text-expense">
              Pemeriksaan menemukan masalah. Pemulihan tidak diizinkan.
              <ul className="ml-5 mt-1 list-disc">{preview.blockers.map((b,i) =>
                <li key={i}>{b}</li>)}</ul>
            </div>
          ) : null}
          {preview.canRestore ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm text-on-surface-variant">
                Budgetku membuat cadangan pengaman sebelum memulihkan.
                Proses akan dibatalkan jika data berubah sejak pemeriksaan.
              </p>
              <label htmlFor="disaster-confirmation" className="text-body-sm font-medium">
                Ketik {CONFIRM} untuk menyetujui penambahan data yang hilang
              </label>
              <input id="disaster-confirmation" value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                disabled={pending} autoComplete="off" spellCheck={false}
                className="min-h-11 rounded-lg border border-input bg-surface-container-lowest px-3 text-body-sm"/>
              <Button type="button" disabled={pending || confirmation !== CONFIRM}
                onClick={() => void request("apply")} className="min-h-11">
                {pending ? "Memulihkan..." : "Pulihkan " + preview.missingCount + " data"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="text-body-sm text-expense">{error}</p> : null}
      {notice ? <p role="status" className="text-body-sm text-on-surface">{notice}</p> : null}
    </section>
  );
}
