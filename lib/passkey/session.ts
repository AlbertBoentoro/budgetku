export const PASSKEY_SESSION_COOKIE = "budgetku_passkey_session";
export const PASSKEY_SESSION_TTL_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function sign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
}

export async function createPasskeySession(
  userId: string,
  secret = process.env.PASSKEY_SESSION_SECRET,
  now = Date.now(),
): Promise<{ value: string; expiresAt: number }> {
  if (!secret || secret.length < 32) {
    throw new Error("Passkey session signing secret must be at least 32 characters.");
  }

  const expiresAt = Math.floor(now / 1000) + PASSKEY_SESSION_TTL_SECONDS;
  const payload = base64UrlEncode(encoder.encode(`${userId}:${expiresAt}`));
  const signature = base64UrlEncode(await sign(payload, secret));
  return { value: `${payload}.${signature}`, expiresAt };
}

export async function verifyPasskeySession(
  value: string | undefined,
  userId: string,
  secret = process.env.PASSKEY_SESSION_SECRET,
  now = Date.now(),
): Promise<boolean> {
  if (!value || !secret || secret.length < 32) return false;

  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;

  let decoded: string;
  let suppliedSignature: Uint8Array;
  try {
    decoded = new TextDecoder().decode(base64UrlDecode(payload));
    suppliedSignature = base64UrlDecode(signature);
  } catch {
    return false;
  }

  const [signedUserId, expiry, extraPayload] = decoded.split(":");
  if (
    signedUserId !== userId ||
    !expiry ||
    extraPayload ||
    !/^\d+$/.test(expiry) ||
    Number(expiry) <= Math.floor(now / 1000)
  ) {
    return false;
  }

  const expectedSignature = await sign(payload, secret);
  if (expectedSignature.length !== suppliedSignature.length) return false;

  let difference = 0;
  for (let index = 0; index < expectedSignature.length; index += 1) {
    difference |= expectedSignature[index] ^ suppliedSignature[index];
  }
  return difference === 0;
}
