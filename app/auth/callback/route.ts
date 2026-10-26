import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    redirect("/auth/google-error");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirect("/auth/google-error");
  }

  if (
    request.nextUrl.searchParams.get("next") ===
    "/auth/passkey-recovery"
  ) {
    redirect("/auth/passkey-recovery");
  }

  redirect("/dashboard");
}
