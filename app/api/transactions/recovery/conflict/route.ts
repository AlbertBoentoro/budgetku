import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup, storeVerifiedBackup } from "@/lib/settings/backup-storage";
import { isBackupSnapshotFilename } from "@/lib/settings/backup-safety";
import { sha256 } from "@/lib/settings/backup-storage-core.mjs";
import { createAmountConflict } from "@/lib/settings/transaction-amount-conflicts.mjs";
import { isSmartRestoreAllowed } from "@/lib/settings/smart-restore-guard";

export const maxDuration = 60;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/i;
const CONFIRM = "GUNAKAN VERSI CADANGAN";
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
    const given = new URL(origin);
    return given.protocol === requested.protocol &&
      (given.host === requested.host || given.host === request.headers.get("host"));
  } catch { return false; }
}

/** Changing an amount is NEVER a side effect of scanning a backup.
 * Only an explicitly confirmed, amount-only conflict is eligible.
 */
export async function POST(request: Request) {
  if (!isSmartRestoreAllowed()) return fail("Pemulihan belum tersedia.", 404);
  if (!originAllowed(request) ||
      request.headers.get("x-budgetku-smart-restore-intent") !== "budgetku-smart-restore-v1") {
    return fail("Konfirmasi permintaan tidak valid.", 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].toLowerCase() !== "application/json") {
    return fail("Format harus JSON.", 415);
  }
  let id: string, hash: string, source: { journalEventId: number } |
    { snapshot: string; backupSha256: string };
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2304) return fail("Permintaan terlalu besar.", 413);
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return fail("Pilihan versi tidak valid.", 400);
    }
    const values = data as Record<string, unknown>;
    if (typeof values.id !== "string" || !ID.test(values.id) ||
      typeof values.expectedCurrentSha256 !== "string" ||
      !SHA.test(values.expectedCurrentSha256) ||
      values.confirmation !== CONFIRM ||
      !values.source || typeof values.source !== "object" ||
      Array.isArray(values.source)) {
      return fail("Konfirmasi atau transaksi tidak valid.", 400);
    }
    const s = values.source as Record<string, unknown>;
    if ("journalEventId" in s) {
      if (!Number.isSafeInteger(s.journalEventId) ||
        (s.journalEventId as number) <= 0 || Object.keys(s).length !== 1) {
        return fail("Sumber riwayat tidak valid.", 400);
      }
      source = { journalEventId: s.journalEventId as number };
    } else {
      if (typeof s.snapshot !== "string" || !isBackupSnapshotFilename(s.snapshot) ||
        typeof s.backupSha256 !== "string" || !SHA.test(s.backupSha256) ||
        Object.keys(s).length !== 2) {
        return fail("Sumber cadangan tidak valid.", 400);
      }
      source = { snapshot: s.snapshot, backupSha256: s.backupSha256.toLowerCase() };
    }
    id = values.id;
    hash = values.expectedCurrentSha256.toLowerCase();
  } catch {
    return fail("Format permintaan tidak valid.", 400);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Silakan masuk kembali.", 401);

  try {
    const current = await buildUserBackup(supabase, user.id);
    if (sha256(JSON.stringify(current.data)) !== hash) {
      return fail("Ada perubahan data sejak pemeriksaan. Periksa ulang pilihan.", 409);
    }
    const live = current.data.transactions.find(row => row.id === id);
    if (!live) return fail("Transaksi saat ini sudah tidak ada. Periksa ulang.", 409);

    let saved: unknown;
    if ("journalEventId" in source) {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: event, error: journalError } = await supabase
        .from("transaction_change_history")
        .select("id,transaction_id,operation,before_row,changed_at")
        .eq("user_id", user.id).eq("id", source.journalEventId)
        .eq("operation", "edit").gte("changed_at", cutoff)
        .maybeSingle();
      if (journalError || !event || event.transaction_id !== id) {
        return fail("Versi transaksi sudah tidak tersedia.", 409);
      }
      const { data: newer, error: newerError } = await supabase
        .from("transaction_change_history").select("id")
        .eq("user_id", user.id).eq("transaction_id", id)
        .gt("id", event.id).limit(1);
      if (newerError || (newer?.length ?? 0) > 0) {
        return fail("Versi ini sudah bukan perubahan terakhir. Periksa ulang.", 409);
      }
      saved = event.before_row;
    } else {
      const verified = await fetchVerifiedBackup(supabase, user.id, source.snapshot);
      if (verified.sha256 !== source.backupSha256) {
        return fail("Cadangan berubah. Periksa ulang.", 409);
      }
      const backup = JSON.parse(verified.text);
      const rows = backup?.data?.transactions;
      if (!Array.isArray(rows)) return fail("Isi cadangan tidak valid.", 409);
      const matches = rows.filter((row: { id?: string }) => row?.id === id);
      if (matches.length !== 1) return fail("Versi transaksi tidak ditemukan.", 409);
      saved = matches[0];
    }

    const conflict = createAmountConflict(saved, live, user.id);
    if (!conflict) {
      return fail("Detail transaksi berubah atau versinya tidak cocok. Tidak ada yang ditimpa.", 409);
    }

    // Save an immutable safety snapshot BEFORE an authenticated write.
    await storeVerifiedBackup(supabase, user.id, current);

    // Compare-and-set protects against concurrent edits, deletes and most
    // metadata changes while the remote backup is being validated.
    let update = supabase.from("transactions")
      .update({ amount: conflict.savedAmount, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id)
      .eq("amount", conflict.currentAmount)
      .eq("updated_at", live.updated_at)
      .eq("account_id", live.account_id)
      .eq("transaction_type", live.transaction_type)
      .eq("transaction_at", live.transaction_at)
      .eq("created_at", live.created_at)
      .eq("currency", "IDR")
      .eq("source", "manual")
      .is("source_reference", null);
    update = live.category_id === null ? update.is("category_id", null) :
      update.eq("category_id", live.category_id);
    update = live.destination_account_id === null ? update.is("destination_account_id", null) :
      update.eq("destination_account_id", live.destination_account_id);
    update = live.merchant === null ? update.is("merchant", null) :
      update.eq("merchant", live.merchant);
    update = live.description === null ? update.is("description", null) :
      update.eq("description", live.description);
    const { data: changed, error: updateError } = await update.select("id,amount").maybeSingle();
    if (updateError || !changed) {
      return fail("Transaksi berubah saat diproses. Nilai lama tidak diterapkan.", 409);
    }

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    revalidatePath("/reports");
    return Response.json({
      ok: true,
      beforeAmount: conflict.currentAmount,
      afterAmount: conflict.savedAmount,
      message: "Pilihan disimpan. Perubahan ini juga tercatat dalam riwayat 30 hari.",
    }, { headers: HEADERS });
  } catch (error) {
    console.error("Amount conflict resolution failed:",
      error instanceof Error ? error.message : "unknown");
    return fail("Pilihan versi gagal diproses. Data tidak otomatis ditimpa.", 422);
  }
}
