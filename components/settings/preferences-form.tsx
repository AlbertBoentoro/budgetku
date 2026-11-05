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
  dailyReminderEnabled,
  reminderConfigured,
}: {
  dailyReminderEnabled: boolean;
  reminderConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettings, INITIAL_STATE);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="flex items-start gap-3">
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
