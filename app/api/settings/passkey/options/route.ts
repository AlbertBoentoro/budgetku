import {
  generateRegistrationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";

import { createClient } from "@/lib/supabase/server";
import {
  getWebAuthnConfig,
  passkeySigningConfigured,
  saveChallenge,
} from "@/lib/passkey/webauthn";

function supportedTransports(values: string[]): AuthenticatorTransportFuture[] {
  const allowed: AuthenticatorTransportFuture[] = [
    "ble",
    "cable",
    "hybrid",
    "internal",
    "nfc",
    "smart-card",
    "usb",
  ];
  return values.filter((value): value is AuthenticatorTransportFuture =>
    allowed.includes(value as AuthenticatorTransportFuture),
  );
}

export async function GET(request: Request) {
  if (!passkeySigningConfigured()) {
    return Response.json(
      { error: "Passkey belum dikonfigurasi di server." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json(
      { error: "Sesi berakhir. Masuk kembali." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const [{ data: credentials, error: credentialError }, config] =
      await Promise.all([
        supabase
          .from("passkey_credentials")
          .select("credential_id, transports")
          .eq("user_id", user.id),
        Promise.resolve(getWebAuthnConfig(request)),
      ]);

    if (credentialError) throw new Error(credentialError.message);

    const options = await generateRegistrationOptions({
      rpName: "Budgetku",
      rpID: config.rpID,
      userID: Buffer.from(user.id),
      userName: user.email ?? user.id,
      userDisplayName:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : user.email ?? "Akun Budgetku",
      attestationType: "none",
      timeout: 60_000,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: supportedTransports(credential.transports),
      })),
    });

    const challengeId = await saveChallenge(
      supabase,
      user.id,
      options.challenge,
      "registration",
    );

    return Response.json(
      { options, challengeId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Passkey registration options failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "Passkey belum bisa disiapkan. Coba lagi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
