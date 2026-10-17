import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "crypto";

/**
 * Server-only symmetric encryption for Gmail OAuth tokens at rest.
 *
 * Tokens (refresh/access) are never stored in plaintext and never leave the
 * server. We use AES-256-GCM: a random 12-byte IV per encryption plus the
 * 16-byte GCM auth tag give both confidentiality and tamper detection (a
 * modified ciphertext fails the auth-tag check on decrypt and throws).
 *
 * Boundary: this module reads a secret env var and must never be imported from
 * a `"use client"` file. The server boundary is enforced by that import
 * discipline plus the Node built-in `crypto` import, which fails a client
 * bundle build. The `typeof window` guard below is cheap defense-in-depth only
 * (it never fires during server build/SSR where `window` is undefined).
 */

// Defense-in-depth only: not the real boundary enforcer (see module comment).
if (typeof window !== "undefined") {
  throw new Error("lib/crypto.ts is server-only and must not run in the browser.");
}

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Load and validate the 32-byte AES key from GMAIL_TOKEN_ENCRYPTION_KEY
 * (base64). Throws a value-free error if the env var is missing or not exactly
 * 32 bytes after decoding, so callers can surface the honest server-misconfig
 * copy without leaking the env var name or any key material.
 */
function loadKey(): Buffer {
  const key = Buffer.from(process.env.GMAIL_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("Server encryption key is missing or has an invalid length.");
  }
  return key;
}

/**
 * Encrypt a plaintext secret. Returns `base64(iv).base64(authTag).base64(ciphertext)`.
 */
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv) as CipherGCM;

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Decrypt a payload produced by `encryptSecret`. Throws on malformed input or
 * when the auth tag does not verify (tamper detection). Decrypt only ever runs
 * server-side during token refresh/revoke; the plaintext token is never logged
 * or returned to the client.
 */
export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Encrypted payload is malformed.");
  }

  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  if (iv.length !== IV_BYTES || authTag.length !== 16) {
    throw new Error("Encrypted payload is malformed.");
  }

  const key = loadKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv) as DecipherGCM;
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
