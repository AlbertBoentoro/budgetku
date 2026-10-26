"use client";

import { useActionState } from "react";

import {
  saveSettings,
  type SettingsActionState,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const INITIAL_STATE: SettingsActionState = { ok: false, message: "" };

export function PreferencesForm({
  firstDayOfWeek,
  dailyReminderEnabled,
  reminderConfigured,
}: {
  firstDayOfWeek: "monday" | "sunday";
  dailyReminderEnabled: boolean;
  reminderConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettings, INITIAL_STATE);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="firstDayOfWeek"
          className="text-body-md font-medium text-on-surface"
        >
          Minggu dimulai pada
        </label>
        <select
          id="firstDayOfWeek"
          name="firstDayOfWeek"
          defaultValue={firstDayOfWeek}
          className="h-11 rounded-lg border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="monday">Senin</option>
          <option value="sunday">Minggu</option>
        </select>
        <p className="text-body-sm text-on-surface-variant">
          Pilihan ini disimpan di akun Anda.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-body-md font-medium text-on-surface">
            Format wilayah
          </p>
          <p className="text-body-sm text-on-surface-variant">
            Indonesia, Rupiah (IDR)
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-body-sm text-on-surface-variant">
          Tetap
        </span>
      </div>

      <div className="flex items-start gap-3 border-t border-outline-variant pt-4">
        <Checkbox
          id="dailyReminderEnabled"
          name="dailyReminderEnabled"
          defaultChecked={dailyReminderEnabled}
          disabled={!reminderConfigured && !dailyReminderEnabled}
          className="size-11 rounded-md"
          aria-label="Aktifkan pengingat harian"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label
            htmlFor="dailyReminderEnabled"
            className="text-body-md font-medium text-on-surface"
          >
            Pengingat harian
          </label>
          <p className="text-body-sm text-on-surface-variant">
            Ingatkan untuk mencatat transaksi setiap hari.
          </p>
          <p className="text-body-sm text-on-surface-variant">
            Setiap hari sekitar pukul 20.00 WIB.
          </p>
          {!reminderConfigured ? (
            <p className="text-body-sm text-on-surface-variant">
              Menunggu konfigurasi Web Push di server.
            </p>
          ) : null}
        </div>
      </div>

      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "text-body-sm text-primary"
              : "text-body-sm text-expense"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full sm:w-auto sm:self-end"
      >
        {pending ? "Menyimpan..." : "Simpan pengaturan"}
      </Button>
    </form>
  );
}
