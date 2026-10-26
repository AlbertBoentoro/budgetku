import { NextResponse } from "next/server";

import { clearPasskeySession } from "@/lib/passkey/cookie";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return new Response("Permintaan keluar tidak valid.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out failed:", error.message);
    return Response.json(
      { error: "Tidak bisa keluar dari akun. Coba lagi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearPasskeySession(response);
  return response;
}
