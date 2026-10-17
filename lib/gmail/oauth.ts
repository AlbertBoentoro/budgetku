import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";

import { GMAIL_SCOPES } from "@/lib/gmail/config";

/**
 * Server-only Gmail OAuth helpers. Builds the consent URL, exchanges the auth
 * code for tokens, and reads the connected email address from the Google
 * userinfo endpoint. Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
 * GOOGLE_OAUTH_REDIRECT_URI by name only; never imported from a client bundle
 * (the googleapis import fails a client build).
 */

// Defense-in-depth only (see lib/crypto.ts for the real boundary rationale).
if (typeof window !== "undefined") {
  throw new Error("lib/gmail/oauth.ts is server-only and must not run in the browser.");
}

/**
 * Create an unauthenticated OAuth2 client from the server env config. Throws a
 * value-free error if any required var is missing so callers can surface the
 * honest server-misconfig copy without leaking env names or values.
 */
export function createOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Gmail OAuth configuration is incomplete on the server.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Build the Google consent URL. `access_type=offline` + `prompt=consent`
 * ensures a refresh token is always returned, even on reconnect. `state` is the
 * caller-generated CSRF token verified in the callback.
 */
export function buildConsentUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: false,
    scope: [...GMAIL_SCOPES],
    state,
  });
}

/**
 * Exchange an authorization code for tokens. Returns the raw Credentials; the
 * caller is responsible for checking that a `refresh_token` is present and for
 * encrypting tokens before persistence.
 */
export async function exchangeCode(code: string): Promise<Credentials> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * Fetch the connected Gmail address via the Google userinfo endpoint using a
 * freshly obtained access token. Returns null when the address is unavailable
 * so the caller can surface an honest error rather than fabricate a value.
 */
export async function fetchConnectedEmail(
  accessToken: string,
): Promise<string | null> {
  const authClient = createOAuthClient();
  authClient.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: "v2", auth: authClient });
  const { data } = await oauth2.userinfo.get();

  return data.email ?? null;
}
