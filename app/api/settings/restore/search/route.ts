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
const MAX_JOURNAL_EVENTS = 500;
const DAYS = 30;
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
    const [page, top, current, journal] = await Promise.all([
      storage.list(folder, {
        limit: PAGE_SIZE + 1, offset, sortBy: { column: "name", order: "desc" },
      }),
      offset === 0 ? Promise.resolve(null) : storage.list(folder, {
        limit: 1, sortBy: { column: "name", order: "desc" },
      }),
      buildUserBackup(supabase, user.id),
      offset === 0
        ? supabase.from("transaction_change_history")
            .select("id,transaction_id,before_row,changed_at")
            .eq("user_id", user.id).eq("operation", "delete")
            .gte("changed_at", new Date(Date.now() - DAYS * 86_400_000).toISOString())
            .order("changed_at", { ascending: false }).limit(MAX_JOURNAL_EVENTS + 1)
        : Promise.resolve(null),
    ]);
    if (page.error || (top && top.error) || (journal && journal.error)) {
      return fail("Tidak bisa memuat riwayat pemulihan.", 503);
    }

    // De-duplicate repeated deletions: most recent verified version wins.
    // Transaction journal entries are written atomically with ledger changes
    // and do not depend on the nightly full-account backup.
    const journalEvents = journal?.data ?? [];
    const journalTruncated = journalEvents.length > MAX_JOURNAL_EVENTS;
    const latestDeleted = new Map<string, (typeof journalEvents)[number]>();
    for (const event of journalEvents.slice(0, MAX_JOURNAL_EVENTS)) {
      if (!latestDeleted.has(event.transaction_id)) latestDeleted.set(event.transaction_id, event);
    }
    const deletedRows = [...latestDeleted.values()];
    const journalCandidates: Array<{
      id: string; snapshot: string; backupSha256: string; fingerprint: string;
      journalEventId?: number;
      createdAt: string | null; transactionAt: string; amount: number;
      transactionType: string; merchant: string | null; description: string | null;
      accountId: string; accountName: string;
      destinationAccountId: string | null; destinationAccountName: string | null;
      categoryName: string | null; eligible: boolean; reason: string | null;
    }> = [];
    if (deletedRows.length > 0) {
      const incoming = {
        format: "budgetku-backup", version: 1,
        data: {
          transactions: deletedRows.map(e => e.before_row),
          accounts: current.data.accounts,
          categories: current.data.categories,
        },
      };
      const plan = createSmartRestorePlan({ incoming, current, userId: user.id });
      const eventByTransactionId = new Map(deletedRows.map(e => [e.transaction_id, e]));
      for (const candidate of plan.candidates) {
        const event = eventByTransactionId.get(candidate.id);
        if (!event || !event.before_row || typeof event.before_row !== "object" ||
          Array.isArray(event.before_row)) {
          throw new Error("Invalid transaction journal entry");
        }
        const saved = event.before_row as Record<string, unknown>;
        journalCandidates.push({
          ...candidate,
          snapshot: "", backupSha256: "", journalEventId: event.id,
          fingerprint: sha256(JSON.stringify([
            saved.user_id, saved.account_id, saved.destination_account_id,
            saved.category_id, saved.transaction_type, saved.amount,
            saved.transaction_at, saved.created_at, saved.updated_at,
            saved.currency, saved.source, saved.source_reference,
            saved.merchant, saved.description,
          ])),
        });
      }
    }
    // Snapshot names start with ISO timestamps and a UUID. Sorting by
    // unique name is stable even when multiple backup files share created_at.
    const newest = offset === 0 ? page.data?.[0]?.name : top?.data?.[0]?.name;
    if (!newest || !isBackupSnapshotFilename(newest)) {
      if (offset > 0) return fail("Riwayat cadangan berubah, ulangi pencarian.", 409);
      return Response.json({
        matches: [], coverage: [], candidates: journalCandidates,
        currentTransactionCount: current.data.transactions.length,
        scanned: 0, skipped: 0, currentSha256: sha256(JSON.stringify(current.data)),
        anchor: null, nextOffset: null, truncated: journalTruncated,
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
    const coverage: Array<{
      createdAt: string; transactionCount: number; presentCount: number;
      missingCount: number; eligibleCount: number; blockedCount: number;
    }> = [];
    const candidates: Array<{
      id: string; snapshot: string; backupSha256: string; fingerprint: string;
      journalEventId?: number;
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
          const incoming = JSON.parse(verified.text);
          const plan = createSmartRestorePlan({
            incoming, current, userId: user.id,
          });
          const backupRows = new Map<string, Record<string, unknown>>(
            (incoming.data.transactions as Array<Record<string, unknown>>)
              .map(row => [row.id as string, row]),
          );
          const found = plan.candidates.map((candidate: Omit<(typeof candidates)[number], "snapshot" | "backupSha256" | "fingerprint">) => {
            const row = backupRows.get(candidate.id);
            if (!row) throw new Error("Snapshot candidate row missing");
            return {
              ...candidate, snapshot: file.name, backupSha256: verified.sha256,
              fingerprint: sha256(JSON.stringify([
                row.user_id, row.account_id, row.destination_account_id,
                row.category_id, row.transaction_type, row.amount,
                row.transaction_at, row.created_at, row.updated_at,
                row.currency, row.source, row.source_reference,
                row.merchant, row.description,
              ])),
            };
          });
          return {
            summary: plan.candidates.length > 0 ? {
              snapshot: file.name, createdAt,
              missingCount: plan.candidates.length,
              eligibleCount: plan.eligibleCount, blockedCount: plan.blockedCount,
            } : null,
            coverage: {
              createdAt, transactionCount: incoming.data.transactions.length,
              presentCount: plan.alreadyPresent,
              missingCount: plan.candidates.length,
              eligibleCount: plan.eligibleCount, blockedCount: plan.blockedCount,
            },
            found,
          };
        } catch {
          // Corrupt/incompatible backups must not be silently reported as empty.
          return null;
        }
      }));
      for (const value of batch) {
        if (value === null) skipped++;
        else if (value !== undefined) {
          if (value.summary) results.push(value.summary);
          coverage.push(value.coverage);
          candidates.push(...value.found);
        }
      }
    }
    const hasMore = (page.data?.length ?? 0) > PAGE_SIZE;
    const nextOffset = hasMore && offset < MAX_OFFSET ? offset + PAGE_SIZE : null;
    return Response.json({
      matches: results, coverage, candidates: [...journalCandidates, ...candidates],
      currentTransactionCount: current.data.transactions.length,
      scanned: entries.length - skipped, skipped,
      currentSha256: sha256(JSON.stringify(current.data)),
      anchor: newest, nextOffset,
      truncated: journalTruncated || (hasMore && nextOffset === null),
    }, { headers: HEADERS });
  } catch (error) {
    console.error("Read-only recovery search failed:", error instanceof Error ? error.message : "unknown");
    return fail("Pencarian belum berhasil. Tidak ada transaksi yang diubah.", 422);
  }
}
