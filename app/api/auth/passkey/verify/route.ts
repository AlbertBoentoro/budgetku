import {
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { NextResponse } from "next/server";

import { setPasskeySession } from "@/lib/passkey/cookie";
import {
  consumeChallenge,
  getWebAuthnConfig,
  loadChallenge,
  passkeySigningConfigured,
} from "@/lib/passkey/webauthn";
import {
  isAuthenticationResponse,
  isChallengeId,
} from "@/lib/passkey/validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Data passkey tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("challengeId" in body) ||
    !("response" in body) ||
    !isChallengeId(body.challengeId) ||
    !isAuthenticationResponse(body.response)
  ) {
    return Response.json(
      { error: "Data passkey tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const challenge = await loadChallenge(
      supabase,
      user.id,
      body.challengeId,
      "authentication",
    );
    if (!challenge) {
      return Response.json(
        { error: "Permintaan passkey kedaluwarsa. Mulai lagi." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: credential, error: credentialError } = await supabase
      .from("passkey_credentials")
      .select("credential_id, public_key, counter, transports")
      .eq("user_id", user.id)
      .eq("credential_id", body.response.id)
      .maybeSingle();

    if (credentialError) throw new Error(credentialError.message);
    if (!credential) {
      return Response.json(
        { error: "Kunci biometrik tidak terdaftar pada akun ini." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const config = getWebAuthnConfig(request);
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.expectedOrigin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: {
        id: credential.credential_id,
        publicKey: Buffer.from(credential.public_key, "base64url"),
        counter: Number(credential.counter),
        transports: supportedTransports(credential.transports),
      },
    });

    if (!verification.verified) {
      return Response.json(
        { error: "Verifikasi biometrik gagal. Coba lagi." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const consumed = await consumeChallenge(
      supabase,
      user.id,
      challenge.id,
      challenge.challenge,
      "authentication",
    );
    if (!consumed) {
      return Response.json(
        { error: "Permintaan passkey sudah digunakan. Mulai lagi." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("passkey_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("credential_id", credential.credential_id);
    if (updateError) throw new Error(updateError.message);

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    await setPasskeySession(response, user.id);
    return response;
  } catch (error) {
    console.error(
      "Passkey authentication verification failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "Verifikasi passkey gagal. Coba lagi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
