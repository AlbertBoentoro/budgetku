import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup, storeVerifiedBackup } from "@/lib/settings/backup-storage";
import { isBackupSnapshotFilename } from "@/lib/settings/backup-safety";

// This endpoint is STAGING-ONLY until the atomic RPC, Gmail reference
// guarantees and authenticated browser recovery tests are separately reviewed.
// Never allow production project or an arbitrary Supabase URL to apply restores.
const STAGING_SUPABASE_URL = "https://omnzuolrlwczvnxrvenw.supabase.co";
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

type RestoreRequest = {
  mode?: "preview" | "apply";
  snapshot?: string;
  sha256?: string;
  confirmation?: string;
};

type RestoreRpcResult = {
  ok: boolean;
  counts: Record<string, number>;
};

function failure(message: string, status: number) {
  return Response.json({ ok: false, message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (
    process.env.BUDGETKU_STAGING_E2E !== "true" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_SUPABASE_URL
  ) {
    return failure("Pemulihan belum diaktifkan di lingkungan ini.", 403);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return failure("Sesi berakhir. Masuk lagi.", 401);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 4096) return failure("Permintaan terlalu besar.", 413);

  let input: RestoreRequest;
  try {
    input = await request.json() as RestoreRequest;
  } catch {
    return failure("Permintaan tidak valid.", 400);
  }
  if (input.mode !== "preview" && input.mode !== "apply") {
    return failure("Mode pemulihan tidak valid.", 400);
  }
  if (typeof input.snapshot !== "string" ||
      !isBackupSnapshotFilename(input.snapshot)) {
    return failure("Pilih cadangan bertanggal yang valid.", 400);
  }

  let found: Awaited<ReturnType<typeof fetchVerifiedBackup>>;
  try {
    found = await fetchVerifiedBackup(supabase, user.id, input.snapshot);
  } catch {
    return failure("Cadangan gagal diverifikasi atau tidak ditemukan.", 422);
  }

  if (input.mode === "preview") {
    return Response.json({
      ok: true,
      snapshot: input.snapshot,
      generatedAt: found.inspection.generatedAt,
      sha256: found.sha256,
      counts: found.inspection.counts,
      note: "Ini hanya pemeriksaan, belum mengubah rekening atau transaksi.",
    }, { headers: NO_STORE });
  }

  if (
    input.confirmation !== "PULIHKAN" ||
    typeof input.sha256 !== "string" ||
    input.sha256 !== found.sha256
  ) {
    return failure("Konfirmasi atau checksum tidak cocok. Preview ulang cadangan.", 409);
  }

  // A verified pre-restore snapshot is published *before* any ledger changes.
  // It remains recoverable even if the following SQL transaction rejects data.
  try {
    const current = await buildUserBackup(supabase, user.id);
    await storeVerifiedBackup(supabase, user.id, current);
  } catch {
    return failure("Cadangan pengaman sebelum pemulihan gagal. Data tidak diubah.", 503);
  }

  // Postgres RPC runs in a single DB transaction; an error rolls back all
  // inserts/deletes/updates. The SQL function uses caller RLS (not service role).
  // Generated DB types intentionally do not yet include this staging-only RPC.
  const rpc = supabase.rpc as unknown as (
    name: "restore_budgetku_backup_v1",
    args: { p_backup: unknown },
  ) => Promise<{ data: RestoreRpcResult | null; error: { message: string } | null }>;

  const { data, error } = await rpc("restore_budgetku_backup_v1", {
    p_backup: JSON.parse(found.text) as unknown,
  });
  if (error || !data?.ok) {
    console.error("Staging atomic restore rejected:", error?.message ?? "No result");
    return failure(
      "Pemulihan ditolak demi keamanan data. Cadangan pengaman sudah disimpan.",
      409,
    );
  }

  return Response.json({
    ok: true,
    restored: data.counts,
    message: "Data berhasil dipulihkan secara atomik di staging.",
  }, { headers: NO_STORE });
}
