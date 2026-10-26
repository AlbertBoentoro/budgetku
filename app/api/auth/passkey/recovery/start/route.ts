import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PASSKEY_SESSION_COOKIE } from "@/lib/passkey/session";
import { createClient } from "@/lib/supabase/server";

const RECOVERY_COOKIE = "budgetku_passkey_recovery";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return new Response("Permintaan pemulihan tidak valid.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Sesi berakhir. Masuk kembali.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(
    RECOVERY_COOKIE,
    `${user.id}.${randomBytes(32).toString("base64url")}`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    },
  );

  const { error } = await supabase.auth.signOut();
  if (error) {
    cookieStore.delete(RECOVERY_COOKIE);
    console.error("Passkey recovery could not sign out:", error.message);
    return new Response("Tidak bisa memulai pemulihan. Coba lagi.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  cookieStore.delete(PASSKEY_SESSION_COOKIE);
  return NextResponse.json(
    { ok: true, next: "/auth/passkey-recovery/login" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
