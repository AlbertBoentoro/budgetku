"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

function decodeBase64Url(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

export function PushSetup({
  configured,
  initiallyEnabled,
}: {
  configured: boolean;
  initiallyEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!configured || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    const syncState = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration(
          "/service-worker.js",
        );
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;

        const response = await fetch(
          `/api/settings/push?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Push status request failed.");
        const result: { enabled: boolean } = await response.json();
        if (!cancelled) setEnabled(result.enabled);
      } catch {
        if (!cancelled) {
          setMessage("Status notifikasi gagal diperiksa.");
        }
      }
    };

    void syncState();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  async function enable() {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setMessage("Browser ini belum mendukung notifikasi web.");
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          permission === "denied"
            ? "Izin notifikasi ditolak. Ubah izinnya di pengaturan browser."
            : "Izin notifikasi belum diberikan.",
        );
        return;
      }

      const keyResponse = await fetch("/api/settings/push", {
        cache: "no-store",
      });
      if (!keyResponse.ok) {
        setMessage(await keyResponse.text());
        return;
      }

      const { publicKey }: { publicKey: string } = await keyResponse.json();
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(publicKey),
        }));

      const response = await fetch("/api/settings/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        setMessage(await response.text());
        return;
      }

      setEnabled(true);
      setMessage("Notifikasi aktif di perangkat ini.");
    } catch {
      setMessage("Notifikasi gagal diaktifkan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.getRegistration(
        "/service-worker.js",
      );
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        const response = await fetch("/api/settings/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) {
          setMessage(await response.text());
          return;
        }
        await subscription.unsubscribe();
      }

      setEnabled(false);
      setMessage("Notifikasi dinonaktifkan di perangkat ini.");
    } catch {
      setMessage("Notifikasi gagal dinonaktifkan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="notifications" size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-body-md font-medium text-on-surface">
            Notifikasi perangkat
          </p>
          <p className="text-body-sm text-on-surface-variant">
            {configured
              ? "Aktifkan izin browser agar pengingat harian bisa diterima."
              : "Perlu konfigurasi Web Push di server sebelum dapat digunakan."}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant={enabled ? "outline" : "default"}
        disabled={!configured || pending}
        onClick={enabled ? disable : enable}
        className="h-11 w-full sm:w-auto sm:self-end"
      >
        {pending
          ? "Memproses..."
          : enabled
            ? "Matikan di perangkat ini"
            : "Aktifkan di perangkat ini"}
      </Button>
      {message ? (
        <p role="status" aria-live="polite" className="text-body-sm text-on-surface-variant">
          {message}
        </p>
      ) : null}
    </div>
  );
}
