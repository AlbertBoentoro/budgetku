import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

import { createOAuthClient } from "@/lib/gmail/oauth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { createClient } from "@/lib/supabase/server";

/**
 * Server-only authorized Gmail client factory. Given a user's connection id,
 * it decrypts the stored refresh token, builds an authorized OAuth2 client,
 * refreshes the access token when it is missing or expired (persisting the new
 * encrypted access token + expiry), and returns an authorized gmail_v1 client.
 *
 * Never imported from a client bundle. Tokens exist decrypted only in server
 * memory during this call; nothing token-shaped is logged or returned.
 */

// Defense-in-depth only (see lib/crypto.ts for the real boundary rationale).
if (typeof window !== "undefined") {
  throw new Error("lib/gmail/client.ts is server-only and must not run in the browser.");
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Thrown when the stored grant is no longer valid (revoked/expired). The caller
// flips the connection to an error state and tells the user to reconnect.
export class GmailReconnectRequiredError extends Error {
  constructor(message = "Koneksi Gmail kedaluwarsa atau dicabut. Hubungkan ulang untuk melanjutkan.") {
    super(message);
    this.name = "GmailReconnectRequiredError";
  }
}

// A one-minute skew so a token about to expire is refreshed proactively.
const EXPIRY_SKEW_MS = 60_000;

/**
 * Narrow Google's refresh errors to the revoked/expired case. The library
 * surfaces this as an `invalid_grant` OAuth error; anything else is a transient
 * or configuration failure the caller handles as a generic sync error.
 */
function isInvalidGrant(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybe = error as { response?: { data?: { error?: string } }; message?: string };
  if (maybe.response?.data?.error === "invalid_grant") return true;
  return typeof maybe.message === "string" && maybe.message.includes("invalid_grant");
}

/**
 * Build an authorized gmail_v1 client for the given connection.
 *
 * Security: the caller MUST pass the authenticated user's id (from
 * supabase.auth.getUser(), never client input); every read/write here is
 * `.eq("user_id", userId)`-scoped and fail-closed. On an invalid grant the
 * connection is marked `error` with a sanitized, token-free `last_error` and a
 * {@link GmailReconnectRequiredError} is thrown.
 */
export async function createGmailClient(
  supabase: ServerSupabaseClient,
  userId: string,
  connectionId: string,
): Promise<gmail_v1.Gmail> {
  const { data: secret, error: secretError } = await supabase
    .from("email_connection_secrets")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (secretError) {
    throw new Error(`Gagal memuat kredensial Gmail: ${secretError.message}`);
  }
  if (!secret) {
    throw new GmailReconnectRequiredError();
  }

  const refreshToken = decryptSecret(secret.refresh_token);
  const authClient = createOAuthClient();

  const expiresAtMs = secret.access_token_expires_at
    ? Date.parse(secret.access_token_expires_at)
    : null;
  const accessTokenValid =
    secret.access_token !== null &&
    expiresAtMs !== null &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs - EXPIRY_SKEW_MS > Date.now();

  if (accessTokenValid && secret.access_token) {
    authClient.setCredentials({
      refresh_token: refreshToken,
      access_token: decryptSecret(secret.access_token),
      expiry_date: expiresAtMs,
    });
  } else {
    authClient.setCredentials({ refresh_token: refreshToken });
    await refreshAndPersist(supabase, userId, connectionId, authClient);
  }

  return google.gmail({ version: "v1", auth: authClient });
}

/**
 * Refresh the access token and persist the re-encrypted token + expiry. On an
 * invalid grant, flag the connection and throw a reconnect-needed error.
 */
async function refreshAndPersist(
  supabase: ServerSupabaseClient,
  userId: string,
  connectionId: string,
  authClient: OAuth2Client,
): Promise<void> {
  let accessToken: string | null | undefined;
  let expiryDate: number | null | undefined;

  try {
    const { credentials } = await authClient.refreshAccessToken();
    accessToken = credentials.access_token;
    expiryDate = credentials.expiry_date;
  } catch (error) {
    if (isInvalidGrant(error)) {
      await supabase
        .from("email_connections")
        .update({
          status: "error",
          last_error:
            "Koneksi Gmail kedaluwarsa atau dicabut. Hubungkan ulang untuk melanjutkan.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId)
        .eq("user_id", userId);
      throw new GmailReconnectRequiredError();
    }
    throw new Error("Gagal memperbarui akses Gmail. Coba lagi sebentar lagi.");
  }

  if (!accessToken) {
    throw new Error("Gagal memperbarui akses Gmail. Coba lagi sebentar lagi.");
  }

  const expiresAtIso =
    typeof expiryDate === "number" ? new Date(expiryDate).toISOString() : null;

  const { error: persistError } = await supabase
    .from("email_connection_secrets")
    .update({
      access_token: encryptSecret(accessToken),
      access_token_expires_at: expiresAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("connection_id", connectionId);

  if (persistError) {
    throw new Error(`Gagal menyimpan akses Gmail: ${persistError.message}`);
  }
}
