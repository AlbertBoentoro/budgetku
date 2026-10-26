import { createClient } from "@/lib/supabase/server";
import { buildUserBackup } from "@/lib/settings/backup";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Sesi berakhir. Masuk kembali.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const backup = await buildUserBackup(supabase, user.id);
    const filenameDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="budgetku-data-${filenameDate}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Data export failed:", error);
    return new Response("Data gagal diekspor. Coba lagi.", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
