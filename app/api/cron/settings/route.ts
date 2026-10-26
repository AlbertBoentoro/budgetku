import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import type { PushSubscription } from "web-push";

import type { Database, Json } from "@/lib/supabase/database.types";
import { buildUserBackup } from "@/lib/settings/backup";
import { isAllowedPushEndpoint } from "@/lib/settings/push";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "budgetku-backups";
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
type ScheduledSetting = Pick<
  Database["public"]["Tables"]["user_settings"]["Row"],
  | "user_id"
  | "cloud_backup_enabled"
  | "daily_reminder_enabled"
  | "last_reminder_sent_on"
>;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

function jakartaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toPushSubscription(value: Json): PushSubscription | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const endpoint = value.endpoint;
  const keys = value.keys;
  if (
    typeof endpoint !== "string" ||
    !isAllowedPushEndpoint(endpoint) ||
    typeof keys !== "object" ||
    keys === null ||
    Array.isArray(keys) ||
    typeof keys.auth !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(keys.auth) ||
    typeof keys.p256dh !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(keys.p256dh)
  ) {
    return null;
  }

  return { endpoint, keys: { auth: keys.auth, p256dh: keys.p256dh } };
}

function statusCodeOf(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { error: "Cron authentication is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isAuthorized(request)) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error("Settings cron is missing Supabase admin configuration.", error);
    return Response.json(
      { error: "Scheduled settings are not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const settings: ScheduledSetting[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("user_settings")
      .select(
        "user_id, cloud_backup_enabled, daily_reminder_enabled, last_reminder_sent_on",
      )
      .or("cloud_backup_enabled.eq.true,daily_reminder_enabled.eq.true")
      .order("user_id")
      .range(from, from + 999);

    if (error) {
      console.error(
        "Settings cron could not load schedules:",
        error.message,
      );
      return Response.json(
        { error: "Scheduled settings could not be loaded." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    settings.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const today = jakartaDate();
  let backupsCreated = 0;
  let remindersSent = 0;
  let failures = 0;

  for (const setting of settings) {
    if (setting.cloud_backup_enabled) {
      try {
        const backup = await buildUserBackup(supabase, setting.user_id);
        const body = JSON.stringify(backup);
        if (new TextEncoder().encode(body).byteLength > MAX_BACKUP_BYTES) {
          throw new Error("Backup exceeds the configured storage limit.");
        }

        const path = `${setting.user_id}/latest.json`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, body, {
            contentType: "application/json",
            upsert: true,
          });
        if (uploadError) throw new Error(uploadError.message);

        const { error: updateError } = await supabase
          .from("user_settings")
          .update({
            last_backup_at: backup.generatedAt,
            updated_at: backup.generatedAt,
          })
          .eq("user_id", setting.user_id);
        if (updateError) throw new Error(updateError.message);
        backupsCreated += 1;
      } catch (error) {
        console.error("Scheduled backup failed for one account.", error);
        failures += 1;
      }
    }

    if (
      setting.daily_reminder_enabled &&
      setting.last_reminder_sent_on !== today
    ) {
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from("push_subscriptions")
        .select("id, subscription")
        .eq("user_id", setting.user_id);

      if (subscriptionError) {
        console.error("Scheduled reminder lookup failed.", subscriptionError.message);
        failures += 1;
        continue;
      }

      if (!subscriptions.length) continue;

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      const subject = process.env.VAPID_SUBJECT;
      if (!publicKey || !privateKey || !subject) {
        console.error("Scheduled reminders are missing VAPID configuration.");
        failures += 1;
        continue;
      }

      webpush.setVapidDetails(subject, publicKey, privateKey);
      let sentForUser = false;
      let failedForUser = false;

      for (const row of subscriptions) {
        const subscription = toPushSubscription(row.subscription);
        if (!subscription) {
          failedForUser = true;
          continue;
        }

        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: "Budgetku",
              body: "Sudah mencatat transaksi hari ini? Cek pengeluaranmu.",
              url: "/transactions",
            }),
          );
          sentForUser = true;
        } catch (error) {
          const statusCode = statusCodeOf(error);
          if (statusCode === 404 || statusCode === 410) {
            const { error: deleteError } = await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", row.id);
            if (deleteError) {
              console.error("Expired push subscription cleanup failed.");
              failedForUser = true;
            }
          } else {
            console.error("Scheduled push delivery failed.");
            failedForUser = true;
          }
        }
      }

      if (sentForUser) {
        const { error: updateError } = await supabase
          .from("user_settings")
          .update({ last_reminder_sent_on: today })
          .eq("user_id", setting.user_id);
        if (updateError) {
          console.error("Reminder schedule could not be recorded.");
          failures += 1;
        } else {
          remindersSent += 1;
          if (failedForUser) failures += 1;
        }
      } else if (failedForUser) {
        failures += 1;
      }
    }
  }

  return Response.json(
    { backupsCreated, remindersSent, failures },
    {
      status: failures ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
