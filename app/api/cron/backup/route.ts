import { timingSafeEqual } from "node:crypto";

import { buildUserBackup } from "@/lib/settings/backup";
import { hasBackupForWibDay } from "@/lib/settings/backup-day";
import { storeVerifiedBackup } from "@/lib/settings/backup-storage";
import { createAdminClient } from "@/lib/supabase/admin";

// This endpoint runs independently at local midnight. The reminder endpoint
// continues at 20:00 WIB and does not execute backups.
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
    console.error("Backup cron is missing Supabase admin configuration.", error);
    return Response.json(
      { error: "Scheduled backups are not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let backupsCreated = 0;
  let backupsSkipped = 0;
  let failures = 0;

  const backupUserIds = new Set<string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      console.error("Settings cron could not list accounts:", error.message);
      return Response.json(
        { error: "Scheduled backups could not load accounts." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    for (const user of data.users) backupUserIds.add(user.id);
    if (data.users.length < 1000) break;
  }

  for (const userId of backupUserIds) {
    try {
      // A cron retry after an already verified backup should not create another
      // full immutable snapshot on the same WIB day. Manual backups also count.
      // This is a retry guard, not a cross-process lock: two parallel cron
      // requests can still race, so never delete snapshots automatically.
      const { data: settings, error: readError } = await supabase
        .from("user_settings")
        .select("last_backup_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (hasBackupForWibDay(settings?.last_backup_at ?? null, new Date().toISOString())) {
        backupsSkipped += 1;
        continue;
      }

      const backup = await buildUserBackup(supabase, userId);
      await storeVerifiedBackup(supabase, userId, backup);

      const { error: updateError } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: userId,
            last_backup_at: backup.generatedAt,
            updated_at: backup.generatedAt,
          },
          { onConflict: "user_id" },
        );
      if (updateError) throw new Error(updateError.message);
      backupsCreated += 1;
    } catch (error) {
      console.error("Scheduled backup failed for one account.", error);
      failures += 1;
    }
  }

  return Response.json(
    { backupsCreated, backupsSkipped, failures },
    { status: failures ? 500 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
