import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";

const BUCKET = "budgetku-backups";
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

  const path = `${user.id}/latest.json`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadError) {
    console.error("Manual backup upload failed:", uploadError.message);
    return textResponse("Cadangan gagal disimpan. Coba lagi.", 500);
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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return textResponse("Sesi berakhir. Masuk kembali.", 401);

  const { data: file, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(`${user.id}/latest.json`);

  if (downloadError) {
    if (downloadError.message.toLowerCase().includes("not found")) {
      return textResponse("Belum ada cadangan cloud.", 404);
    }
    console.error("Backup download failed:", downloadError.message);
    return textResponse("Cadangan cloud gagal diunduh.", 500);
  }

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="budgetku-cadangan.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
