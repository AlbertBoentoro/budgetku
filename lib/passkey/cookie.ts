import { NextResponse } from "next/server";

import {
  createPasskeySession,
  PASSKEY_SESSION_COOKIE,
  PASSKEY_SESSION_TTL_SECONDS,
} from "@/lib/passkey/session";

export async function setPasskeySession(
  response: NextResponse,
  userId: string,
): Promise<void> {
  const session = await createPasskeySession(userId);
  response.cookies.set(PASSKEY_SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PASSKEY_SESSION_TTL_SECONDS,
    expires: new Date(session.expiresAt * 1000),
  });
}

export function clearPasskeySession(response: NextResponse): void {
  response.cookies.set(PASSKEY_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
