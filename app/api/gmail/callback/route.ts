import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { encryptSecret } from "@/lib/crypto";
import {
  GMAIL_OAUTH_STATE_COOKIE,
  GMAIL_SCOPES,
  GMAIL_SETTINGS_PATH,
} from "@/lib/gmail/config";
import { exchangeCode, fetchConnectedEmail } from "@/lib/gmail/oauth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gmail/callback — OAuth redirect target (design §4.2). Path must equal
 * GOOGLE_OAUTH_REDIRECT_URI (= /api/gmail/callback). Verifies the single-use
 * CSRF state, exchanges the code, reads the connected address, and persists the
 * connection + encrypted secret via explicit select-then-write (NOT .upsert()
 * on user_id — BLOCKER-2). Every failure maps to a documented ?err= flag; no
 * secret value is ever logged or returned to the client.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();

  // Single-use: always clear the state cookie regardless of outcome.
  const storedState = cookieStore.get(GMAIL_OAUTH_STATE_COOKIE)?.value ?? null;
  cookieStore.delete(GMAIL_OAUTH_STATE_COOKIE);

  // User denied consent (or Google returned an error).
  if (searchParams.get("error")) {
    redirect(`${GMAIL_SETTINGS_PATH}?err=denied`);
  }

  // CSRF state check: query must match the single-use cookie.
  const queryState = searchParams.get("state");
  if (!storedState || !queryState || storedState !== queryState) {
    redirect(`${GMAIL_SETTINGS_PATH}?err=state`);
  }

  const code = searchParams.get("code");
  if (!code) {
    redirect(`${GMAIL_SETTINGS_PATH}?err=exchange`);
  }

  let tokens;
  try {
    tokens = await exchangeCode(code as string);
  } catch {
    redirect(`${GMAIL_SETTINGS_PATH}?err=exchange`);
  }

  // A refresh token is required to function (prompt=consent should guarantee
  // one; a prior grant without it would omit it).
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    redirect(`${GMAIL_SETTINGS_PATH}?err=norefresh`);
  }

  const accessToken = tokens.access_token ?? null;

  let email: string | null = null;
  if (accessToken) {
    try {
      email = await fetchConnectedEmail(accessToken);
    } catch {
      email = null;
    }
  }
  if (!email) {
    redirect(`${GMAIL_SETTINGS_PATH}?err=userinfo`);
  }

  // Persist the connection with an explicit select-then-insert/update — NOT
  // .upsert() on user_id (no unique constraint exists; BLOCKER-2). Pick the
  // most-recent row as the current connection; reuse its id so the
  // email_imports composite FK stays valid across reconnect.
  const { data: existing, error: selectError } = await supabase
    .from("email_connections")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    redirect(`${GMAIL_SETTINGS_PATH}?err=persist`);
  }

  const nowIso = new Date().toISOString();
  let connectionId: string;

  if (existing) {
    const { error: updateError } = await supabase
      .from("email_connections")
      .update({
        email_address: email as string,
        status: "active",
        last_error: null,
        updated_at: nowIso,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (updateError) {
      redirect(`${GMAIL_SETTINGS_PATH}?err=persist`);
    }
    connectionId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("email_connections")
      .insert({
        user_id: user.id,
        email_address: email as string,
        status: "active",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      redirect(`${GMAIL_SETTINGS_PATH}?err=persist`);
    }
    connectionId = (inserted as { id: string }).id;
  }

  // Persist the secret keyed on connection_id (unique, 1:1 — a .upsert on
  // connection_id would be valid, but we use select-then-write for symmetry).
  const { data: existingSecret, error: secretSelectError } = await supabase
    .from("email_connection_secrets")
    .select("connection_id")
    .eq("user_id", user.id)
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (secretSelectError) {
    redirect(`${GMAIL_SETTINGS_PATH}?err=persist`);
  }

  const expiresAtIso =
    typeof tokens.expiry_date === "number"
      ? new Date(tokens.expiry_date).toISOString()
      : null;

  const secretPayload = {
    refresh_token: encryptSecret(refreshToken),
    access_token: accessToken ? encryptSecret(accessToken) : null,
    access_token_expires_at: expiresAtIso,
    scopes: [...GMAIL_SCOPES],
    updated_at: nowIso,
  };

  if (existingSecret) {
    const { error: secretUpdateError } = await supabase
      .from("email_connection_secrets")
      .update(secretPayload)
      .eq("user_id", user.id)
      .eq("connection_id", connectionId);

    if (secretUpdateError) {
      redirect(`${GMAIL_SETTINGS_PATH}?err=persist`);
    }
  } else {
    const { error: secretInsertError } = await supabase
      .from("email_connection_secrets")
      .insert({
        user_id: user.id,
        connection_id: connectionId,
        ...secretPayload,
      });

    if (secretInsertError) {
      redirect(`${GMAIL_SETTINGS_PATH}?err=persist`);
    }
  }

  redirect(`${GMAIL_SETTINGS_PATH}?ok=connected`);
}
