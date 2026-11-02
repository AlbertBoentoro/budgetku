import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup, storeVerifiedBackup } from "@/lib/settings/backup-storage";
import { sha256 } from "@/lib/settings/backup-storage-core.mjs";
import { isBackupSnapshotFilename } from "@/lib/settings/backup-safety";
import { createRestorePreview } from "@/lib/settings/restore-plan-core.mjs";
import { isStagingRestoreAllowed } from "@/lib/settings/staging-restore-guard";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";

export const maxDuration = 60;

const RECONFIRM = "PULIHKAN DATA";
const PROOF = "staging-v1-confirmed";
function fail(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    const expected = new URL(request.url);
    const host = request.headers.get("host");
    if (site && site !== "same-origin" && site !== "none") return false;
    if (origin && (new URL(origin).protocol !== expected.protocol ||
        (new URL(origin).host !== expected.host && new URL(origin).host !== host))) {
      return false;
    }
    return request.headers.get("x-budgetku-restore-intent") === PROOF &&
      request.headers.get("content-type")?.split(";")[0].toLowerCase() === "application/json";
  } catch {
    return false;
  }
}

/**
 * STAGING-ONLY demonstration: never installed in, or enabled for, production.
 * Rechecks an immutable snapshot against live account/ledger data, then
 * creates an immutable recoverable safety snapshot BEFORE invoking PostgreSQL.
 * The prototype RPC runs atomically under caller RLS, and rejects stale rows.
 * A separate production-grade concurrency/security review is still required.
 */
export async function POST(request: Request) {
  if (!isStagingRestoreAllowed()) return fail("Fitur pemulihan belum tersedia.", 404);
  if (!sameOrigin(request)) return fail("Konfirmasi keamanan tidak valid.", 403);
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Silakan masuk kembali.", 401);

  let input: {
    snapshot?: unknown;
    expectedBackupSha256?: unknown;
    expectedCurrentSha256?: unknown;
    confirmation?: unknown;
  };
  try {
    if (Number(request.headers.get("content-length") ?? "0") > 2048) {
      return fail("Permintaan terlalu besar.", 413);
    }
    input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return fail("Permintaan tidak valid.", 400);
    }
  } catch {
    return fail("Permintaan harus berupa JSON.", 400);
  }
  if (input.confirmation !== RECONFIRM) {
    return fail("Ketik PULIHKAN DATA sebagai persetujuan.", 400);
  }
  // Explicit immutable snapshot: never restore from the mutable latest.json
  // pointer, which is replaced when the mandatory safety backup is stored.
  if (typeof input.snapshot !== "string" || !isBackupSnapshotFilename(input.snapshot)) {
    return fail("Pilih cadangan bertanggal yang terverifikasi.", 400);
  }
  if (typeof input.expectedBackupSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(input.expectedBackupSha256) ||
    typeof input.expectedCurrentSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(input.expectedCurrentSha256)) {
    return fail("Pratinjau tidak valid. Periksa ulang cadangan.", 400);
  }
  try {
    const [saved, current, linked] = await Promise.all([
      fetchVerifiedBackup(supabase, user.id, input.snapshot),
      buildUserBackup(supabase, user.id),
      fetchAllPages((from, to) => supabase.from("email_imports")
        .select("id, transaction_id")
        .eq("user_id", user.id)
        .not("transaction_id", "is", null)
        .order("id").range(from, to)),
    ]);
    if (input.expectedBackupSha256.toLowerCase() !== saved.sha256) {
      return fail("Cadangan berubah. Periksa ulang sebelum pemulihan.", 409);
    }

    // The user's preview becomes invalid if even one row changes, including
    // a new transaction not displayed in the impact table. Never silently
    // apply a wider deletion than the user explicitly reviewed.
    if (input.expectedCurrentSha256.toLowerCase() !== sha256(JSON.stringify(current.data))) {
      return fail("Data berubah sejak pratinjau. Periksa ulang dampak Restore.", 409);
    }

    const backup = JSON.parse(saved.text);
    const plan = createRestorePreview({
      incoming: backup,
      current,
      userId: user.id,
      linkedTransactionIds: linked.flatMap(row => row.transaction_id ? [row.transaction_id] : []),
    });
    if (!plan.eligibleForAtomicRestore) {
      return Response.json({
        error: "Pemulihan diblokir oleh pemeriksaan keamanan. Data tidak diubah.",
        blockers: plan.blockers,
      }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    }

    // Verified safety snapshot is immutable and downloadable from history.
    // If writing or read-back fails, the atomic restore MUST NOT run.
    const safety = await storeVerifiedBackup(supabase, user.id, current);

    // The staging SQL function deliberately does not appear in production
    // generated Database types. No privileged service-role client is used.
    const caller = supabase as unknown as {
      rpc: (name: string, args: {
        p_backup_data: Record<string, unknown>;
        p_expected_current_data: Record<string, unknown>;
        p_force_rollback: boolean;
      }) => Promise<{ data: {restored: boolean; transactions: number} | null; error: {message: string; code?: string} | null }>;
    };
    const result = await caller.rpc("budgetku_restore_atomic_v1_test", {
      p_backup_data: backup.data,
      p_expected_current_data: current.data,
      p_force_rollback: false,
    });
    if (result.error || !result.data?.restored) {
      console.error("Staging atomic restore rejected:", result.error?.code ?? "no result");
      return Response.json({
        error: "Pemulihan dibatalkan oleh database. Data sebelum pemulihan tetap tersedia dalam cadangan pengaman.",
        safetySnapshot: safety.snapshot,
      }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    }
    return Response.json({
      ok: true,
      transactions: result.data.transactions,
      safetySnapshot: safety.snapshot,
      restoredSnapshot: input.snapshot,
      message: "Pemulihan staging berhasil. Cadangan pengaman sebelum pemulihan disimpan.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Staging recovery flow stopped:", error instanceof Error ? error.message : "unknown");
    return fail("Pemulihan tidak dijalankan atau dibatalkan. Periksa cadangan dan ulangi pratinjau.", 422);
  }
}
