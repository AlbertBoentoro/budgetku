import { NextResponse } from "next/server";

import { clearPasskeySession } from "@/lib/passkey/cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "Sesi berakhir. Masuk kembali." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("Passkey removal is missing server configuration.", error);
    return Response.json(
      { error: "Kunci biometrik belum bisa dinonaktifkan." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await admin.rpc("disable_passkeys", {
    p_user_id: user.id,
  });
  if (error || !data) {
    console.error("Passkey removal failed:", error?.message ?? "No result.");
    return Response.json(
      { error: "Kunci biometrik gagal dinonaktifkan." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { ok: true, message: "Kunci biometrik dinonaktifkan." },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearPasskeySession(response);
  return response;
}
