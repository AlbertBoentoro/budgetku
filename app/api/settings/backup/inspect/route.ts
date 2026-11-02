import { createClient } from "@/lib/supabase/server";
import { fetchVerifiedBackup } from "@/lib/settings/backup-storage";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sesi berakhir." }, { status: 401 });

  try {
    const snapshot = new URL(request.url).searchParams.get("snapshot") ?? undefined;
    const { inspection, sha256 } = await fetchVerifiedBackup(supabase, user.id, snapshot);
    return Response.json({ valid: true, sha256, ...inspection }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({
      valid: false,
      message: "Cadangan tidak dapat dibaca atau tidak sesuai dengan format Budgetku.",
    }, {
      status: 422,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
