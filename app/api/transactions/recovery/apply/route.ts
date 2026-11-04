import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";
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
type BackupSelection = { id: string; snapshot: string; backupSha256: string };
type JournalSelection = { id: string; journalEventId: number };
type Selection = BackupSelection | JournalSelection;
const isJournal = (s: Selection): s is JournalSelection => "journalEventId" in s;
const isBackup = (s: Selection): s is BackupSelection => !isJournal(s);
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
      if (typeof row.id !== "string" || !ID.test(row.id)) return false;
      if ("journalEventId" in row) {
        return Number.isSafeInteger(row.journalEventId) && (row.journalEventId as number) > 0 &&
          !("snapshot" in row) && !("backupSha256" in row);
      }
      return typeof row.snapshot === "string" && isBackupSnapshotFilename(row.snapshot) &&
        typeof row.backupSha256 === "string" && SHA.test(row.backupSha256);
    })) return fail("Pilihan sumber pemulihan tidak valid.", 400);
    selections = values.selections as Selection[];
    if (new Set(selections.map(s => s.id)).size !== selections.length ||
      new Set(selections.filter(isBackup).map(s => s.snapshot)).size > MAX_BACKUPS) {
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
    const bySnapshot = new Map<string, BackupSelection[]>();
    for (const item of selections.filter(isBackup)) {
      const rows = bySnapshot.get(item.snapshot) ?? [];
      rows.push(item);
      bySnapshot.set(item.snapshot, rows);
    }

    const verifiedRows: Json[] = [];
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
    // A recent deletion is recoverable even if the nightly full backup has
    // never included it. Read immutable owner-scoped journal rows server-side,
    // validate their references with the same planner, and feed ALL chosen
    // records to the existing one-transaction atomic database RPC.
    const recent = selections.filter(isJournal);
    if (recent.length > 0) {
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: events, error: journalError } = await supabase
        .from("transaction_change_history")
        .select("id,user_id,transaction_id,operation,before_row,changed_at")
        .eq("user_id", user.id).eq("operation", "delete")
        .gte("changed_at", cutoff)
        .in("id", recent.map(row => row.journalEventId));
      if (journalError || !events || events.length !== recent.length) {
        return fail("Riwayat perubahan kedaluwarsa atau tidak tersedia. Cari ulang.", 409);
      }
      const byEventId = new Map(events.map(e => [e.id, e]));
      for (const item of recent) {
        const event = byEventId.get(item.journalEventId);
        if (!event || event.transaction_id !== item.id || event.user_id !== user.id ||
          !event.before_row || typeof event.before_row !== "object" ||
          Array.isArray(event.before_row)) {
          return fail("Transaksi tidak cocok dengan riwayat perubahan.", 409);
        }
        // Reject replaying an older delete when the same record was later
        // restored, edited, or deleted again. Latest history wins.
        const { data: newer, error: newerError } = await supabase
          .from("transaction_change_history").select("id")
          .eq("user_id", user.id).eq("transaction_id", item.id)
          .gt("id", event.id).limit(1);
        if (newerError || (newer && newer.length > 0)) {
          return fail("Riwayat transaksi telah berubah. Cari ulang.", 409);
        }
        const incoming = {
          format: "budgetku-backup", version: 1,
          data: {
            transactions: [event.before_row],
            accounts: current.data.accounts,
            categories: current.data.categories,
          },
        };
        const plan = createSmartRestorePlan({ incoming, current, userId: user.id });
        if (plan.candidates.length !== 1 ||
          plan.candidates[0].id !== item.id || !plan.candidates[0].eligible) {
          return fail("Transaksi belum dapat dipulihkan. Periksa kembali kategori atau rekening.", 409);
        }
        verifiedRows.push(event.before_row as Json);
      }
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
