import {
  generateAuthenticationOptions,
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
    const [{ data: settings, error: settingsError }, config] =
      await Promise.all([
        supabase
          .from("user_settings")
          .select("passkey_enabled")
          .eq("user_id", user.id)
          .maybeSingle(),
        Promise.resolve(getWebAuthnConfig(request)),
      ]);
    if (settingsError) throw new Error(settingsError.message);
    if (!settings?.passkey_enabled) {
      return Response.json(
        { error: "Kunci biometrik tidak aktif." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: credentials, error: credentialError } = await supabase
      .from("passkey_credentials")
      .select("credential_id, transports")
      .eq("user_id", user.id);
    if (credentialError) throw new Error(credentialError.message);
    if (!credentials.length) {
      return Response.json(
        { error: "Belum ada kunci biometrik untuk akun ini." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: "required",
      timeout: 60_000,
      allowCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: supportedTransports(credential.transports),
      })),
    });

    const challengeId = await saveChallenge(
      supabase,
      user.id,
      options.challenge,
      "authentication",
    );
    return Response.json(
      { options, challengeId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Passkey authentication options failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "Kunci biometrik belum bisa disiapkan. Coba lagi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
