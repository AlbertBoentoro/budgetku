"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = {
  message: string;
  ok: boolean;
};

export async function saveSettings(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const firstDayOfWeek = formData.get("firstDayOfWeek");
  const reminderEnabled = formData.get("dailyReminderEnabled") === "on";
  const backupEnabled = formData.get("cloudBackupEnabled") === "on";

  if (firstDayOfWeek !== "monday" && firstDayOfWeek !== "sunday") {
    return { ok: false, message: "Pilih hari pertama minggu yang valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Masuk kembali untuk menyimpan." };
  }

  const reminderConfigured = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT &&
    process.env.CRON_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const backupConfigured = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET,
  );

  if (
    (reminderEnabled && !reminderConfigured) ||
    (backupEnabled && !backupConfigured)
  ) {
    const { data: current, error: currentError } = await supabase
      .from("user_settings")
      .select("daily_reminder_enabled, cloud_backup_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentError) {
      console.error("Settings validation failed:", currentError.message);
      return { ok: false, message: "Pengaturan gagal diperiksa. Coba lagi." };
    }
    if (
      reminderEnabled &&
      !reminderConfigured &&
      !current?.daily_reminder_enabled
    ) {
      return {
        ok: false,
        message:
          "Pengingat belum bisa diaktifkan karena konfigurasi server belum lengkap.",
      };
    }
    if (
      backupEnabled &&
      !backupConfigured &&
      !current?.cloud_backup_enabled
    ) {
      return {
        ok: false,
        message:
          "Cadangan otomatis belum bisa diaktifkan karena konfigurasi server belum lengkap.",
      };
    }
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      first_day_of_week: firstDayOfWeek,
      daily_reminder_enabled: reminderEnabled,
      daily_reminder_time: "20:00",
      cloud_backup_enabled: backupEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Settings save failed:", error.message);
    return { ok: false, message: "Pengaturan gagal disimpan. Coba lagi." };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Pengaturan tersimpan." };
}
