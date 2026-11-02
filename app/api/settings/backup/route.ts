import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";
import { fetchVerifiedBackup, storeVerifiedBackup } from "@/lib/settings/backup-storage";

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return textResponse("Sesi berakhir. Masuk kembali.", 401);

  let backup: Awaited<ReturnType<typeof buildUserBackup>>;
  try {
    backup = await buildUserBackup(supabase, user.id);
  } catch (error) {
    console.error("Manual backup generation failed:", error);
    return textResponse("Cadangan gagal dibuat. Coba lagi.", 500);
  }

  const body = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(body).byteLength > MAX_BACKUP_BYTES) {
    return textResponse(
      "Data cadangan melebihi batas 10 MB. Unduh file JSON sebagai gantinya.",
      413,
    );
  }

  // Protect previous backups: save a new immutable file and read it back
  // before updating latest.json or the displayed backup timestamp.
  try {
    await storeVerifiedBackup(supabase, user.id, backup);
  } catch (error) {
    console.error("Manual verified backup creation failed:", error);
    return textResponse("Cadangan belum berhasil diverifikasi. Cadangan sebelumnya tetap disimpan.", 500);
  }

  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, last_backup_at: backup.generatedAt },
      { onConflict: "user_id" },
    );

  if (settingsError) {
    console.error("Manual backup timestamp update failed:", settingsError.message);
    return textResponse(
      "Cadangan tersimpan, tetapi status waktunya gagal diperbarui.",
      500,
    );
  }

  return Response.json(
    { ok: true, message: "Cadangan cloud berhasil dibuat." },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return textResponse("Sesi berakhir. Masuk kembali.", 401);

  const url = new URL(request.url);
  const snapshot = url.searchParams.get("snapshot") ?? undefined;

  try {
    const result = await fetchVerifiedBackup(supabase, user.id, snapshot);
    return new Response(result.text, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="budgetku-cadangan.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Backup validation or download failed:", error);
    return textResponse(
      "Cadangan tidak ditemukan atau gagal diverifikasi. Gunakan cadangan bertanggal lain.",
      422,
    );
  }
}
