import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup } from "@/lib/settings/backup-storage";
import { isBackupSnapshotFilename } from "@/lib/settings/backup-safety";
import { createSmartRestorePlan } from "@/lib/settings/smart-restore-plan.mjs";
import { sha256 } from "@/lib/settings/backup-storage-core.mjs";
import { isSmartRestoreAllowed } from "@/lib/settings/smart-restore-guard";

export const maxDuration = 60;

const PAGE_SIZE = 10;
const MAX_OFFSET = 490;
const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: HEADERS });
}
function allowedOrigin(request: Request) {
  try {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    if (!origin) return true;
    const target = new URL(request.url);
    const supplied = new URL(origin);
    return supplied.protocol === target.protocol &&
      (supplied.host === target.host || supplied.host === request.headers.get("host"));
  } catch { return false; }
}

/** Read-only scan of ten immutable, verified snapshots in the current user's folder.
 * UI follows nextOffset across pages, with explicit cap and skip reporting.
 * To actually recover a row, the user must still open a specific single-backup
 * preview and confirm the existing authenticated restore endpoint.
 */
export async function POST(request: Request) {
  if (!isSmartRestoreAllowed()) return fail("Pencarian cadangan belum tersedia.", 404);
  if (!allowedOrigin(request)) return fail("Asal permintaan tidak valid.", 403);
  if (request.headers.get("content-type")?.split(";")[0].toLowerCase() !== "application/json") {
    return fail("Permintaan harus JSON.", 415);
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Silakan masuk kembali.", 401);

  let offset: number, anchor: string | null;
  try {
    if (Number(request.headers.get("content-length") || "0") > 1024) return fail("Permintaan terlalu besar.", 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 1024) return fail("Permintaan terlalu besar.", 413);
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return fail("Format permintaan salah.", 400);
    }
    const v = input as { offset?: unknown; anchor?: unknown };
    if (!Number.isInteger(v.offset) || (v.offset as number) < 0 ||
      (v.offset as number) > MAX_OFFSET || (v.offset as number) % PAGE_SIZE !== 0 ||
      (v.anchor !== null && (typeof v.anchor !== "string" ||
        !isBackupSnapshotFilename(v.anchor))) ||
      ((v.offset as number) === 0 ? v.anchor !== null : v.anchor === null)) {
      return fail("Parameter pencarian tidak valid.", 400);
    }
    offset = v.offset as number;
    anchor = v.anchor as string | null;
  } catch {
    return fail("Permintaan pencarian tidak valid.", 400);
  }

  try {
    const storage = supabase.storage.from("budgetku-backups");
    const folder = user.id + "/snapshots";
    const [page, top, current] = await Promise.all([
      storage.list(folder, {
        limit: PAGE_SIZE + 1, offset, sortBy: { column: "name", order: "desc" },
      }),
      offset === 0 ? Promise.resolve(null) : storage.list(folder, {
        limit: 1, sortBy: { column: "name", order: "desc" },
      }),
      buildUserBackup(supabase, user.id),
    ]);
    if (page.error || (top && top.error)) {
      return fail("Tidak bisa memuat riwayat cadangan.", 503);
    }
    // Snapshot names start with ISO timestamps and a UUID. Sorting by
    // unique name is stable even when multiple backup files share created_at.
    const newest = offset === 0 ? page.data?.[0]?.name : top?.data?.[0]?.name;
    if (!newest || !isBackupSnapshotFilename(newest)) {
      if (offset > 0) return fail("Riwayat cadangan berubah, ulangi pencarian.", 409);
      return Response.json({
        matches: [], candidates: [], scanned: 0, skipped: 0, currentSha256: sha256(JSON.stringify(current.data)),
        anchor: null, nextOffset: null, truncated: false,
      }, { headers: HEADERS });
    }
    if (anchor !== null && newest !== anchor) {
      return fail("Riwayat cadangan bertambah atau berubah. Mulai ulang pencarian.", 409);
    }
    const entries = (page.data ?? []).slice(0, PAGE_SIZE);
    let skipped = 0;
    const results: Array<{
      snapshot: string; createdAt: string; missingCount: number;
      eligibleCount: number; blockedCount: number;
    }> = [];
    const candidates: Array<{
      id: string; snapshot: string; backupSha256: string; fingerprint: string;
      createdAt: string | null; transactionAt: string;
      amount: number; transactionType: string;
      merchant: string | null; description: string | null;
      accountId: string; accountName: string;
      destinationAccountId: string | null; destinationAccountName: string | null;
      categoryName: string | null; eligible: boolean; reason: string | null;
    }> = [];
    // Small batches to bound memory and response latency; no Storage writes.
    for (let i = 0; i < entries.length; i += 3) {
      const batch = await Promise.all(entries.slice(i, i + 3).map(async (file) => {
        const createdAt = file.created_at;
        if (!isBackupSnapshotFilename(file.name) || typeof createdAt !== "string") return null;
        try {
          const verified = await fetchVerifiedBackup(supabase, user.id, file.name);
          const plan = createSmartRestorePlan({
            incoming: JSON.parse(verified.text), current, userId: user.id,
          });
          if (plan.candidates.length === 0) return undefined;
          return {
            snapshot: file.name, createdAt,
            missingCount: plan.candidates.length,
            eligibleCount: plan.eligibleCount, blockedCount: plan.blockedCount,
          };
        } catch {
          // Corrupt/incompatible backups must not be silently reported as empty.
          return null;
        }
      }));
      for (const value of batch) {
        if (value === null) skipped++;
        else if (value !== undefined) {
          results.push(value.summary);
          candidates.push(...value.found);
        }
      }
    }
    const hasMore = (page.data?.length ?? 0) > PAGE_SIZE;
    const nextOffset = hasMore && offset < MAX_OFFSET ? offset + PAGE_SIZE : null;
    return Response.json({
      matches: results, candidates, scanned: entries.length - skipped, skipped,
      currentSha256: sha256(JSON.stringify(current.data)),
      anchor: newest, nextOffset,
      truncated: hasMore && nextOffset === null,
    }, { headers: HEADERS });
  } catch (error) {
    console.error("Read-only backup search failed:", error instanceof Error ? error.message : "unknown");
    return fail("Pencarian belum berhasil. Tidak ada transaksi yang diubah.", 422);
  }
}
