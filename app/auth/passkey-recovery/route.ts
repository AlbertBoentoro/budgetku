import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PASSKEY_SESSION_COOKIE } from "@/lib/passkey/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const RECOVERY_COOKIE = "budgetku_passkey_recovery";

export async function GET() {
  const cookieStore = await cookies();
  const recoveryToken = cookieStore.get(RECOVERY_COOKIE)?.value;
  cookieStore.delete(RECOVERY_COOKIE);
  cookieStore.delete(PASSKEY_SESSION_COOKIE);

  if (!recoveryToken) redirect("/auth/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [recoveryUserId, recoveryNonce] = recoveryToken.split(".");
  if (recoveryUserId !== user.id || !recoveryNonce) redirect("/auth/login");

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("Passkey account recovery is missing server configuration.", error);
    return new Response(
      "Pemulihan gagal. Silakan coba lagi atau hubungi dukungan.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { data, error } = await admin.rpc("disable_passkeys", {
    p_user_id: user.id,
  });
  if (error || !data) {
    console.error(
      "Passkey account recovery failed:",
      error?.message ?? "No result.",
    );
    return new Response(
      "Pemulihan gagal. Silakan coba lagi atau hubungi dukungan.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  redirect("/settings");
}
