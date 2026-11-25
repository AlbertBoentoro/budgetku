"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isStagingEmailLoginAllowed } from "@/lib/auth/staging-email-login";

export type SettingsActionState = {
  message: string;
  ok: boolean;
  savedReminderEnabled?: boolean;
};

export async function saveSettings(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const reminderValue = formData.get("dailyReminderEnabled");
  if (reminderValue !== "on" && reminderValue !== "off") {
    return { ok: false, message: "Pilihan pengingat tidak valid. Coba lagi." };
  }
  const reminderEnabled = reminderValue === "on";

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
  const stagingPreferenceTest = process.env.VERCEL_ENV === "preview" && isStagingEmailLoginAllowed();
  if (reminderEnabled && !reminderConfigured && !stagingPreferenceTest) {
    const { data: current, error: currentError } = await supabase
      .from("user_settings")
      .select("daily_reminder_enabled")
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
  }

  const { data: saved, error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      first_day_of_week: "monday",
      locale: "id-ID",
      currency: "IDR",
      daily_reminder_enabled: reminderEnabled,
      daily_reminder_time: "20:00",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  ).select("daily_reminder_enabled").single();

  if (error) {
    console.error("Settings save failed:", error.message);
    return { ok: false, message: "Pengaturan gagal disimpan. Coba lagi." };
  }

  if (saved?.daily_reminder_enabled !== reminderEnabled) {
    return { ok: false, message: "Status pengingat belum tersimpan. Coba lagi." };
  }

  revalidatePath("/settings");
  return {
    ok: true,
    savedReminderEnabled: saved.daily_reminder_enabled,
    message: stagingPreferenceTest && !reminderConfigured && reminderEnabled
      ? "Pengaturan tersimpan. Mode testing: pengiriman notifikasi belum aktif."
      : "Pengaturan tersimpan.",
  };
}
