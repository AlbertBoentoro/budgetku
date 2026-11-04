import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup, storeVerifiedBackup } from "@/lib/settings/backup-storage";
import { inspectBackupJson, isBackupSnapshotFilename } from "@/lib/settings/backup-safety";
import { sha256 } from "@/lib/settings/backup-storage-core.mjs";
import { createRestorePreview } from "@/lib/settings/restore-plan-core.mjs";
import { isSmartRestoreAllowed } from "@/lib/settings/smart-restore-guard";

export const maxDuration = 60;
const CONFIRM = "PULIHKAN DATA";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/i;
const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: HEADERS });
}
function originAllowed(request: Request) {
  try {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    if (!origin) return true;
    const requested = new URL(request.url);
    const supplied = new URL(origin);
    return supplied.protocol === requested.protocol &&
      (supplied.host === requested.host || supplied.host === request.headers.get("host"));
  } catch { return false; }
}

/** Disaster recovery for missing rows only. Never overwrite newer data.
 * Cloud: verified immutable user-owned snapshot.
 * File: locally selected user-owned Budgetku JSON, <= 10MiB.
 * Both paths must pass the same structural, owner, FK and safety checks.
 */
export async function POST(request: Request) {
  if (!isSmartRestoreAllowed()) return fail("Pemulihan data belum tersedia.", 404);
  if (!originAllowed(request) ||
      request.headers.get("x-budgetku-restore-intent") !== "budgetku-disaster-recovery-v1") {
    return fail("Asal permintaan tidak valid.", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return fail("Pilih cadangan cloud atau unggah file JSON.", 415);
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_FILE_BYTES + 80_000) {
    return fail("Ukuran file terlalu besar (maksimal 10 MB).", 413);
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Silakan masuk kembali.", 401);

  try {
    const fields = await request.formData();
    const mode = fields.get("mode");
    const source = fields.get("source");
    if (!["preview", "apply"].includes(String(mode)) || !["cloud", "file"].includes(String(source))) {
      return fail("Pilihan pemulihan tidak valid.", 400);
    }
    let raw: string, backupSha256: string;
    if (source === "cloud") {
      const snapshot = fields.get("snapshot");
      if (typeof snapshot !== "string" || !isBackupSnapshotFilename(snapshot)) {
        return fail("Pilih cadangan cloud yang valid.", 400);
      }
      const verified = await fetchVerifiedBackup(supabase, user.id, snapshot);
      raw = verified.text;
      backupSha256 = verified.sha256;
    } else {
      const file = fields.get("file");
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".json") ||
          file.size === 0 || file.size > MAX_FILE_BYTES) {
        return fail("Gunakan file cadangan Budgetku (.json), maksimal 10 MB.", 400);
      }
      raw = await file.text();
      backupSha256 = sha256(raw);
    }
    if (Buffer.byteLength(raw,"utf8") > MAX_FILE_BYTES) return fail("Cadangan melebihi 10 MB.",413);
    const inspection = inspectBackupJson(raw,user.id);
    const incoming: unknown = JSON.parse(raw);
    const current = await buildUserBackup(supabase,user.id);
    const currentSha256 = sha256(JSON.stringify(current.data));
    const plan = createRestorePreview({
      incoming: incoming as {format?:string;version?:number;data:Record<string,unknown>},
      current, userId:user.id,
      // This is strictly insert-only: existing Gmail-linked transactions
      // are never updated/deleted, including IDs absent from this snapshot.
      linkedTransactionIds: [],
    });
    const totalMissing = Object.values(plan.tables).reduce((count,stats) =>
      count + stats.wouldAdd,0);

    if (mode === "preview") {
      return Response.json({
        previewOnly:true, generatedAt:inspection.generatedAt,
        source, backupSha256,currentSha256,
        blockers:plan.blockers,tables:plan.tables,
        missingCount:totalMissing,
        protectedConflicts:Object.values(plan.tables).reduce((n,s) => n+s.wouldUpdate,0),
        protectedNewerRows:Object.values(plan.tables).reduce((n,s) => n+s.wouldRemove,0),
        canRestore:plan.eligibleForAtomicRestore && totalMissing>0,
        message:"Hanya data yang hilang yang akan ditambahkan. Data saat ini tidak ditimpa atau dihapus.",
      },{headers:HEADERS});
    }
    if (fields.get("confirmation") !== CONFIRM) return fail("Konfirmasi pemulihan tidak cocok.",400);
    const expectedBackup = fields.get("expectedBackupSha256");
    const expectedCurrent = fields.get("expectedCurrentSha256");
    if (typeof expectedBackup !== "string" || !SHA.test(expectedBackup) ||
        typeof expectedCurrent !== "string" || !SHA.test(expectedCurrent)) {
      return fail("Pemeriksaan sebelumnya tidak valid. Ulangi pemeriksaan.",400);
    }
    if (expectedBackup.toLowerCase() !== backupSha256 ||
        expectedCurrent.toLowerCase() !== currentSha256) {
      return fail("Cadangan atau kondisi akun berubah. Periksa ulang dahulu.",409);
    }
    if (!plan.eligibleForAtomicRestore) return fail("Cadangan belum lolos pemeriksaan keamanan.",409);
    if (totalMissing===0) return fail("Tidak ada data yang hilang untuk dipulihkan.",409);

    // Preserve current state immutably before any financial mutation. Never
    // remove an existing backup even if the database transaction rejects.
    const safety = await storeVerifiedBackup(supabase,user.id,current);
    const { data: result,error: restoreError } = await supabase.rpc(
      "restore_missing_budgetku_v1",
      { p_backup: incoming as import("@/lib/supabase/database.types").Json },
    );
    if (restoreError || !result || typeof result !== "object" ||
        Array.isArray(result) || result.ok !== true) {
      console.error("Insert-only data recovery rejected:",
        restoreError?.code ?? "invalid-result");
      return fail("Pemulihan ditolak database. Tidak ada data baru yang diterapkan sebagian.",409);
    }
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/reports");
    revalidatePath("/budgets");
    revalidatePath("/settings");
    return Response.json({
      ok:true, inserted:result.inserted, safetySnapshot:safety.snapshot,
      message:"Data yang hilang berhasil ditambahkan. Data terbaru tidak diubah.",
    },{headers:HEADERS});
  } catch (error) {
    console.error("Disaster recovery failed:",error instanceof Error?error.message:"unknown");
    return fail("Cadangan belum bisa diproses. Tidak ada data aktif yang sengaja ditimpa.",422);
  }
}
