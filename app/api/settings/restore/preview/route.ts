import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup } from "@/lib/settings/backup-storage";
import { sha256 } from "@/lib/settings/backup-storage-core.mjs";
import { createRestorePreview } from "@/lib/settings/restore-plan-core.mjs";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";

/**
 * Dry-run only. This endpoint NEVER inserts, updates or deletes financial data.
 * The backup format excludes Gmail connection/import records, so linked
 * transaction IDs must be inspected from the live database before planning.
 */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    const expected = new URL(request.url);
    const host = request.headers.get("host");
    // Next's local server may normalize 127.0.0.1 to localhost in
    // request.url even though the original browser Host stays unchanged.
    if ((site && site !== "same-origin" && site !== "none") ||
        (origin && (new URL(origin).protocol !== expected.protocol ||
          (new URL(origin).host !== expected.host && new URL(origin).host !== host)))) {
      return Response.json({ error: "Permintaan berasal dari situs berbeda." }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "Asal permintaan tidak valid." }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });

  let snapshot: string | undefined;
  try {
    if (Number(request.headers.get("content-length") || "0") > 2048) {
      return Response.json({ error: "Permintaan terlalu besar." }, { status: 413 });
    }
    const body: unknown = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
    }
    const value = (body as Record<string, unknown>).snapshot;
    if (value !== undefined && (typeof value !== "string" || !value)) {
      return Response.json({ error: "Nama cadangan tidak valid." }, { status: 400 });
    }
    snapshot = value as string | undefined;
  } catch {
    return Response.json({ error: "Permintaan harus berupa JSON." }, { status: 400 });
  }

  try {
    const [saved, current, linked] = await Promise.all([
      fetchVerifiedBackup(supabase, user.id, snapshot),
      buildUserBackup(supabase, user.id),
      fetchAllPages((from, to) => supabase
        .from("email_imports")
        .select("id, transaction_id")
        .eq("user_id", user.id)
        .not("transaction_id", "is", null)
        .order("id")
        .range(from, to)),
    ]);
    const plan = createRestorePreview({
      incoming: JSON.parse(saved.text),
      current,
      userId: user.id,
      linkedTransactionIds: linked.map(row => row.transaction_id).filter((id): id is string => Boolean(id)),
    });
    return Response.json({
      ...plan,
      backupGeneratedAt: saved.inspection.generatedAt,
      backupSha256: saved.sha256,
      currentSha256: sha256(JSON.stringify(current.data)),
      message: "Ini hanya pratinjau. Data keuangan belum diubah.",
    }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Backup restore preview failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({
      error: "Pratinjau tidak dapat diverifikasi. Pemulihan dibatalkan tanpa mengubah data.",
    }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
  }
}
