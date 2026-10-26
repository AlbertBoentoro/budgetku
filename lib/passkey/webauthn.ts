import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

type WebAuthnClient = SupabaseClient<Database>;
export type ChallengePurpose = "registration" | "authentication";

export function getWebAuthnConfig(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const requestUrl = new URL(request.url);
  const url = configuredUrl
    ? new URL(configuredUrl)
    : new URL(requestUrl.origin);

  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new Error("Passkeys require HTTPS outside localhost.");
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an origin without a path.");
  }

  return { expectedOrigin: url.origin, rpID: url.hostname };
}

export function passkeySigningConfigured(): boolean {
  return Boolean(
    process.env.PASSKEY_SESSION_SECRET &&
      process.env.PASSKEY_SESSION_SECRET.length >= 32 &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function saveChallenge(
  supabase: WebAuthnClient,
  userId: string,
  challenge: string,
  purpose: ChallengePurpose,
): Promise<string> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("passkey_challenges")
    .insert({ user_id: userId, challenge, purpose, expires_at: expiresAt })
    .select("id")
    .single();

  if (error) throw new Error(`Passkey challenge could not be saved: ${error.message}`);
  return data.id;
}

export async function loadChallenge(
  supabase: WebAuthnClient,
  userId: string,
  challengeId: string,
  purpose: ChallengePurpose,
) {
  const { data, error } = await supabase
    .from("passkey_challenges")
    .select("id, challenge")
    .eq("id", challengeId)
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`Passkey challenge lookup failed: ${error.message}`);
  return data;
}

export async function consumeChallenge(
  supabase: WebAuthnClient,
  userId: string,
  challengeId: string,
  challenge: string,
  purpose: ChallengePurpose,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_passkey_challenge", {
    p_challenge_id: challengeId,
    p_challenge: challenge,
    p_purpose: purpose,
  });

  if (error) throw new Error(`Passkey challenge could not be consumed: ${error.message}`);
  return data;
}
