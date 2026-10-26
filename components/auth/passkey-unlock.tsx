"use client";

import { useState } from "react";
import {
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

import { Button } from "@/components/ui/button";

type AuthenticationOptionsResponse = {
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
};

export function PasskeyUnlock({ nextPath }: { nextPath: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function unlock() {
    if (!window.isSecureContext || !("PublicKeyCredential" in window)) {
      setMessage("Browser ini belum mendukung passkey.");
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const optionsResponse = await fetch("/api/auth/passkey/options", {
        cache: "no-store",
      });
      if (!optionsResponse.ok) {
        const result: { error?: string } = await optionsResponse.json();
        setMessage(result.error ?? "Passkey belum bisa disiapkan.");
        return;
      }

      const { options, challengeId }: AuthenticationOptionsResponse =
        await optionsResponse.json();
      const response = await startAuthentication({ optionsJSON: options });
      const verificationResponse = await fetch(
        "/api/auth/passkey/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId, response }),
        },
      );

      if (!verificationResponse.ok) {
        const result: { error?: string } = await verificationResponse.json();
        setMessage(result.error ?? "Verifikasi biometrik gagal.");
        return;
      }

      window.location.replace(nextPath);
    } catch {
      setMessage("Budgetku belum bisa dibuka dengan passkey. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  async function startRecovery() {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/passkey/recovery/start", {
        method: "POST",
      });
      if (!response.ok) {
        setMessage(await response.text());
        return;
      }

      const result: { next: string } = await response.json();
      window.location.assign(result.next);
    } catch {
      setMessage("Pemulihan belum bisa dimulai. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="flex flex-col gap-5 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-headline-lg text-on-surface">Buka Budgetku</h1>
          <p className="text-body-md text-on-surface-variant">
            Verifikasi dengan Face ID, sidik jari, atau kunci layar perangkat.
          </p>
        </div>
        {message ? (
          <p role="alert" className="text-body-sm text-expense">
            {message}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={pending}
          onClick={unlock}
          className="h-11 w-full"
        >
          {pending ? "Memverifikasi..." : "Buka dengan passkey"}
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={startRecovery}
          className="min-h-11 text-center text-body-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          Tidak bisa memakai passkey? Masuk kembali dengan Google
        </button>
      </section>
    </main>
  );
}
