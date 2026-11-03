import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup, storeVerifiedBackup } from "@/lib/settings/backup-storage";
import { isBackupSnapshotFilename } from "@/lib/settings/backup-safety";
import { sha256 } from "@/lib/settings/backup-storage-core.mjs";
import { createSmartRestorePlan } from "@/lib/settings/smart-restore-plan.mjs";
import { isSmartRestoreAllowed } from "@/lib/settings/smart-restore-guard";

export const maxDuration = 60;

const CONFIRMATION = "PULIHKAN TRANSAKSI";
const INTENT_HEADER = "budgetku-smart-restore-v1";

function fail(message: string, status: number) {
  return Response.json({ error: message }, {
    status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
function checkOrigin(request: Request): boolean {
  try {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    const url = new URL(request.url);
    const host = request.headers.get("host");
    if (origin) {
      const given = new URL(origin);
      if (given.protocol !== url.protocol ||
        (given.host !== url.host && given.host !== host)) return false;
    }
    return request.headers.get("x-budgetku-smart-restore-intent") === INTENT_HEADER &&
      request.headers.get("content-type")?.split(";")[0].toLowerCase() === "application/json";
  } catch {
    return false;
  }
}

/**
 * Authorized write endpoint; enabled only for the exact Budgetku environment.
 * Never trust submitted financial rows. Server reads a SHA-checked immutable
 * backup for the authenticated owner, re-plans against current data, creates
 * a verified safety snapshot, then calls a single RLS-invoker DB transaction.
 */
export async function POST(request: Request) {
  if (!isSmartRestoreAllowed()) {
    return fail("Pemulihan transaksi belum tersedia.", 404);
  }
  if (!checkOrigin(request)) {
    return fail("Konfirmasi asal permintaan tidak valid.", 403);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Silakan masuk kembali.", 401);

  let input: {
    snapshot?: unknown; selectedIds?: unknown; expectedBackupSha256?: unknown;
    expectedCurrentSha256?: unknown; confirmation?: unknown;
  };
  try {
    if (Number(request.headers.get("content-length") || "0") > 8192) {
      return fail("Permintaan terlalu besar.", 413);
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 8192) return fail("Permintaan terlalu besar.", 413);
    input = JSON.parse(raw);
  } catch {
    return fail("Permintaan harus berupa JSON.", 400);
  }
  const isUuid = (value: unknown) => typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const ids = input?.selectedIds;
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    input.confirmation !== CONFIRMATION ||
    typeof input.snapshot !== "string" || !isBackupSnapshotFilename(input.snapshot) ||
    typeof input.expectedBackupSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(input.expectedBackupSha256) ||
    typeof input.expectedCurrentSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(input.expectedCurrentSha256) ||
    !Array.isArray(ids) || ids.length < 1 || ids.length > 50 ||
    !ids.every(isUuid) || new Set(ids).size !== ids.length) {
    return fail("Pilihan atau konfirmasi pemulihan tidak valid.", 400);
  }

  try {
    const [saved, current] = await Promise.all([
      fetchVerifiedBackup(supabase, user.id, input.snapshot),
      buildUserBackup(supabase, user.id),
    ]);
    if (saved.sha256 !== input.expectedBackupSha256.toLowerCase() ||
      sha256(JSON.stringify(current.data)) !== input.expectedCurrentSha256.toLowerCase()) {
      return fail("Data atau backup berubah. Periksa ulang sebelum memulihkan.", 409);
    }

    const backup = JSON.parse(saved.text);
    const plan = createSmartRestorePlan({ incoming: backup, current, userId: user.id });
    const eligibleIds = new Set(plan.candidates.filter(c => c.eligible).map(c => c.id));
    if (!ids.every((id: string) => eligibleIds.has(id))) {
      return fail("Transaksi sudah tersedia atau tidak memenuhi syarat. Periksa ulang.", 409);
    }
    const selection = new Set(ids);
    const rows = backup.data.transactions.filter((row: { id: string }) => selection.has(row.id));
    if (rows.length !== ids.length) return fail("Jumlah transaksi tidak sesuai.", 409);

    // Before any ledger mutation, preserve a recoverable, immutable snapshot.
    const safety = await storeVerifiedBackup(supabase, user.id, current);
    const { data: inserted, error } = await supabase.rpc("restore_selected_transactions_v1", {
      p_rows: rows,
    });
    if (error) {
      console.error("Smart Restore rejected by database:", error.code);
      return fail("Pemulihan dibatalkan. Data saat ini tetap tersimpan. Periksa ulang.", 409);
    }
    if (inserted !== ids.length) {
      console.error("Smart Restore count mismatch");
      return fail("Pemulihan perlu diverifikasi ulang sebelum digunakan.", 500);
    }
    return Response.json({
      ok: true, restoredCount: inserted, safetySnapshot: safety.snapshot,
      message: inserted + " transaksi berhasil dikembalikan. Transaksi lainnya dipertahankan.",
    }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Smart Restore failed:", error instanceof Error ? error.message : "unknown");
    return fail("Pemulihan belum berhasil. Tidak ada transaksi lama yang sengaja dihapus.", 422);
  }
}
