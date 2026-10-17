import crypto from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { buildConsentUrl } from "@/lib/gmail/oauth";
import { GMAIL_OAUTH_STATE_COOKIE } from "@/lib/gmail/config";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gmail/connect — start the Gmail OAuth round-trip (design §4.1).
 * Authenticated only; generates a single-use CSRF `state`, stores it in an
 * httpOnly short-lived cookie, and redirects to Google's consent screen.
 * Mirrors the NextRequest + redirect() pattern in app/auth/confirm/route.ts.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const state = crypto.randomBytes(32).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set(GMAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  redirect(buildConsentUrl(state));
}
