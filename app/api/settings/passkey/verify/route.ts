import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

import { setPasskeySession } from "@/lib/passkey/cookie";
import {
  consumeChallenge,
  getWebAuthnConfig,
  loadChallenge,
  passkeySigningConfigured,
} from "@/lib/passkey/webauthn";
import { isChallengeId, isRegistrationResponse } from "@/lib/passkey/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    !isRegistrationResponse(body.response)
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
      "registration",
    );
    if (!challenge) {
      return Response.json(
        { error: "Permintaan passkey kedaluwarsa. Mulai lagi." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const config = getWebAuthnConfig(request);
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.expectedOrigin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return Response.json(
        { error: "Verifikasi passkey gagal. Coba lagi." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const consumed = await consumeChallenge(
      supabase,
      user.id,
      challenge.id,
      challenge.challenge,
      "registration",
    );
    if (!consumed) {
      return Response.json(
        { error: "Permintaan passkey sudah digunakan. Mulai lagi." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const credential = verification.registrationInfo.credential;
    const admin = createAdminClient();
    const { error: saveError } = await admin.rpc("register_passkey", {
      p_user_id: user.id,
      p_credential_id: credential.id,
      p_public_key: Buffer.from(credential.publicKey).toString("base64url"),
      p_counter: credential.counter,
      p_transports: credential.transports ?? [],
      p_device_name: "Passkey",
    });
    if (saveError) throw new Error(saveError.message);

    const response = NextResponse.json(
      { ok: true, message: "Kunci biometrik berhasil diaktifkan." },
      { headers: { "Cache-Control": "no-store" } },
    );
    await setPasskeySession(response, user.id);
    return response;
  } catch (error) {
    console.error(
      "Passkey registration verification failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "Passkey gagal disimpan. Coba lagi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
