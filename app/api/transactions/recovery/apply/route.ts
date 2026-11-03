import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup, storeVerifiedBackup } from "@/lib/settings/backup-storage";
import { isBackupSnapshotFilename } from "@/lib/settings/backup-safety";
import { sha256 } from "@/lib/settings/backup-storage-core.mjs";
import { createSmartRestorePlan } from "@/lib/settings/smart-restore-plan.mjs";
import { isSmartRestoreAllowed } from "@/lib/settings/smart-restore-guard";

export const maxDuration = 60;

const CONFIRMATION = "PULIHKAN TRANSAKSI";
const INTENT = "budgetku-smart-restore-v1";
const MAX_ROWS = 50;
const MAX_BACKUPS = 10;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/i;
const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
type Selection = { id: string; snapshot: string; backupSha256: string };
function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: HEADERS });
}
function validOrigin(request: Request) {
  try {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    if (!origin) return true;
    const target = new URL(request.url);
    const given = new URL(origin);
    return given.protocol === target.protocol &&
      (given.host === target.host || given.host === request.headers.get("host"));
  } catch { return false; }
}

/**
 * Recover checked rows from several immutable backups in ONE atomic database
 * transaction. No original balances/records are overwritten or deleted.
 * Selected records and checksum are reloaded server-side from user-scoped
 * storage, rechecked against the current ledger and authenticated RLS before
 * a pre-restore safety snapshot and one SECURITY INVOKER RPC.
 */
export async function POST(request: Request) {
  if (!isSmartRestoreAllowed()) return fail("Pemulihan belum tersedia.", 404);
  if (!validOrigin(request) ||
      request.headers.get("x-budgetku-smart-restore-intent") !== INTENT) {
    return fail("Asal atau konfirmasi permintaan tidak valid.", 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].toLowerCase() !== "application/json") {
    return fail("Permintaan harus JSON.", 415);
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Silakan masuk kembali.", 401);

  let selections: Selection[], expectedCurrentSha256: string, confirmation: string;
  try {
    if (Number(request.headers.get("content-length") || "0") > 16000) {
      return fail("Permintaan terlalu besar.", 413);
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 16000) return fail("Permintaan terlalu besar.", 413);
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return fail("Pilihan transaksi tidak valid.", 400);
    }
    const values = input as Record<string, unknown>;
    if (!Array.isArray(values.selections) || values.selections.length === 0 ||
      values.selections.length > MAX_ROWS ||
      typeof values.expectedCurrentSha256 !== "string" ||
      !SHA.test(values.expectedCurrentSha256) ||
      values.confirmation !== CONFIRMATION) {
      return fail("Pilihan atau konfirmasi tidak valid.", 400);
    }
    if (!values.selections.every((r: unknown) => {
      if (!r || typeof r !== "object" || Array.isArray(r)) return false;
      const row = r as Record<string, unknown>;
      return typeof row.id === "string" && ID.test(row.id) &&
        typeof row.snapshot === "string" && isBackupSnapshotFilename(row.snapshot) &&
        typeof row.backupSha256 === "string" && SHA.test(row.backupSha256);
    })) return fail("Pilihan cadangan tidak valid.", 400);
    selections = values.selections as Selection[];
    if (new Set(selections.map(s => s.id)).size !== selections.length ||
      new Set(selections.map(s => s.snapshot)).size > MAX_BACKUPS) {
      return fail("Pilih maksimal 50 transaksi dari 10 versi cadangan per pemulihan.", 400);
    }
    expectedCurrentSha256 = values.expectedCurrentSha256.toLowerCase();
    confirmation = values.confirmation as string;
  } catch {
    return fail("Format permintaan tidak valid.", 400);
  }
  if (confirmation !== CONFIRMATION) return fail("Konfirmasi belum sesuai.", 400);

  try {
    const current = await buildUserBackup(supabase, user.id);
    const currentSha = sha256(JSON.stringify(current.data));
    if (currentSha !== expectedCurrentSha256) {
      return fail("Data transaksi berubah. Cari dan periksa ulang sebelum memulihkan.", 409);
    }

    // Limit external download costs and memory: one verified backup at a time.
    const bySnapshot = new Map<string, Selection[]>();
    for (const item of selections) {
      const rows = bySnapshot.get(item.snapshot) ?? [];
      rows.push(item);
      bySnapshot.set(item.snapshot, rows);
    }

    const verifiedRows: Record<string, unknown>[] = [];
    for (const [snapshot, requests] of bySnapshot) {
      const saved = await fetchVerifiedBackup(supabase, user.id, snapshot);
      if (!requests.every(r => r.backupSha256.toLowerCase() === saved.sha256)) {
        return fail("Isi cadangan berubah. Cari ulang transaksi yang hilang.", 409);
      }
      const backup = JSON.parse(saved.text);
      const plan = createSmartRestorePlan({ incoming: backup, current, userId: user.id });
      const validIds = new Set(plan.candidates.filter(c => c.eligible).map(c => c.id));
      if (!requests.every(r => validIds.has(r.id))) {
        return fail("Salah satu transaksi tidak lagi memenuhi syarat. Cari ulang.", 409);
      }
      const selection = new Set(requests.map(r => r.id));
      const rows = backup.data.transactions.filter((row: { id: string }) => selection.has(row.id));
      if (rows.length !== requests.length) return fail("Transaksi cadangan tidak cocok.", 409);
      verifiedRows.push(...rows);
    }
    if (verifiedRows.length !== selections.length) {
      return fail("Jumlah transaksi tidak cocok. Tidak ada pemulihan.", 409);
    }

    // Preserve present ledger BEFORE attempting financial mutation. If RPC
    // fails, PostgreSQL rolls back all inserts, and this snapshot stays intact.
    const safety = await storeVerifiedBackup(supabase, user.id, current);
    const { data: restoredCount, error } = await supabase.rpc(
      "restore_selected_transactions_v1",
      { p_rows: verifiedRows },
    );
    if (error) {
      console.error("Multi-source recovery rejected:", error.code);
      return fail("Pemulihan dibatalkan. Data tetap aman. Periksa ulang pilihan.", 409);
    }
    if (restoredCount !== selections.length) {
      console.error("Multi-source recovery count mismatch");
      return fail("Pemulihan perlu diperiksa ulang.", 500);
    }

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return Response.json({
      ok: true, restoredCount, safetySnapshot: safety.snapshot,
      message: restoredCount + " transaksi dipulihkan; transaksi lainnya tetap utuh.",
    }, { headers: HEADERS });
  } catch (error) {
    console.error("Multi-source recovery failed:", error instanceof Error ? error.message : "unknown");
    return fail("Pemulihan belum berhasil. Data yang ada tidak sengaja dihapus.", 422);
  }
}
