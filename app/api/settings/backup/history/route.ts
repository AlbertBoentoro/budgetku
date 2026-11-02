import { createClient } from "@/lib/supabase/server";
import { isBackupSnapshotFilename } from "@/lib/settings/backup-safety";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sesi berakhir." }, { status: 401 });

  const { data, error } = await supabase.storage
    .from("budgetku-backups")
    .list(`${user.id}/snapshots`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (error) {
    return Response.json({ error: "Riwayat cadangan tidak bisa dimuat." }, { status: 500 });
  }
  const snapshots = (data ?? [])
    .filter((file) => isBackupSnapshotFilename(file.name))
    .map((file) => ({
      name: file.name,
      createdAt: file.created_at,
      size: file.metadata?.size ?? null,
    }));
  return Response.json({ snapshots }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
