"use client";

import { useState } from "react";
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type RegistrationOptionsResponse = {
  options: PublicKeyCredentialCreationOptionsJSON;
  challengeId: string;
};

export function PasskeySetting({
  enabled,
  credentialCount,
  configured,
}: {
  enabled: boolean;
  credentialCount: number;
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function registerPasskey() {
    if (!window.isSecureContext || !("PublicKeyCredential" in window)) {
      setMessage("Perangkat atau browser ini belum mendukung passkey.");
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const optionsResponse = await fetch("/api/settings/passkey/options", {
        cache: "no-store",
      });
      if (!optionsResponse.ok) {
        const result: { error?: string } = await optionsResponse.json();
        setMessage(result.error ?? "Passkey belum bisa disiapkan.");
        return;
      }

      const { options, challengeId }: RegistrationOptionsResponse =
        await optionsResponse.json();
      const response = await startRegistration({ optionsJSON: options });
      const verificationResponse = await fetch(
        "/api/settings/passkey/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId, response }),
        },
      );

      if (!verificationResponse.ok) {
        const result: { error?: string } = await verificationResponse.json();
        setMessage(result.error ?? "Passkey gagal didaftarkan.");
        return;
      }

      setMessage("Kunci biometrik berhasil diaktifkan.");
      router.refresh();
    } catch {
      setMessage("Passkey gagal didaftarkan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  async function removePasskeys() {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/passkey", {
        method: "DELETE",
      });
      if (!response.ok) {
        const result: { error?: string } = await response.json();
        setMessage(result.error ?? "Kunci biometrik gagal dinonaktifkan.");
        return;
      }

      setConfirmingRemoval(false);
      setMessage("Kunci biometrik dinonaktifkan.");
      router.refresh();
    } catch {
      setMessage("Kunci biometrik gagal dinonaktifkan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="fingerprint" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-medium text-on-surface">
            Kunci biometrik
          </p>
          <p className="text-body-sm text-on-surface-variant">
            {enabled
              ? `${credentialCount} passkey terdaftar. Verifikasi dibutuhkan lagi setelah 12 jam. Jika perangkat hilang, masuk kembali dengan Google untuk memulihkan akses.`
              : "Gunakan Face ID, sidik jari, atau kunci layar perangkat untuk membuka Budgetku."}
          </p>
          {!configured && !enabled ? (
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Menunggu konfigurasi passkey di server.
            </p>
          ) : null}
        </div>
      </div>

      {confirmingRemoval ? (
        <div className="flex flex-col gap-3 border-t border-outline-variant pt-3">
          <p className="text-body-sm text-on-surface-variant">
            Menghapus semua passkey akan menonaktifkan kunci biometrik untuk
            akun ini.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingRemoval(false)}
              className="h-11 min-w-32 flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={removePasskeys}
              className="h-11 min-w-32 flex-1"
            >
              {pending ? "Menonaktifkan..." : "Hapus semua passkey"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {enabled ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingRemoval(true)}
              className="h-11 w-full sm:w-auto"
            >
              Matikan kunci biometrik
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={pending || !configured}
            onClick={registerPasskey}
            className="h-11 w-full sm:w-auto"
          >
            {pending
              ? "Memproses..."
              : enabled
                ? "Tambah passkey"
                : "Aktifkan kunci biometrik"}
          </Button>
        </div>
      )}

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="text-body-sm text-on-surface-variant"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
