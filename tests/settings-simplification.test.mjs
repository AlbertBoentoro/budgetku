import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function file(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("backup and reminders have separate once-daily Jakarta schedules", () => {
  const jobs = JSON.parse(file("vercel.json")).crons;
  assert.deepEqual(jobs, [
    { path: "/api/cron/settings", schedule: "0 13 * * *" },
    { path: "/api/cron/backup", schedule: "0 17 * * *" },
  ]);
  const backup = file("app/api/cron/backup/route.ts");
  const reminders = file("app/api/cron/settings/route.ts");
  assert.match(backup, /isAuthorized\(request\)/);
  assert.match(backup, /timingSafeEqual/);
  assert.match(backup, /buildUserBackup/);
  assert.match(backup, /storeVerifiedBackup/);
  assert.match(backup, /last_backup_at/);
  assert.doesNotMatch(reminders, /buildUserBackup|storeVerifiedBackup|backupsCreated/);
  assert.match(reminders, /last_reminder_sent_on/);
});

test("hidden settings cannot persist Sunday or another region", () => {
  const page = file("app/(app)/settings/page.tsx");
  const pref = file("components/settings/preferences-form.tsx");
  const action = file("app/(app)/settings/actions.ts");
  assert.doesNotMatch(page, /RestorePreviewControls|isSmartRestoreAllowed/);
  assert.doesNotMatch(pref, /firstDayOfWeek|Format wilayah|Minggu dimulai pada/);
  assert.match(action, /first_day_of_week: "monday"/);
  assert.match(action, /locale: "id-ID"/);
  assert.match(action, /currency: "IDR"/);
  assert.doesNotMatch(page, /Data dan cadangan|BackupControls|Cadangkan sekarang|Unduh cadangan/);
  assert.match(page, /settings-export/);
  assert.match(page, /title="Ekspor transaksi"/);
  assert.doesNotMatch(page, /href="\/api\/export\/data"|Ekspor semua data/);
  assert.match(page, /Excel \(\.xlsx\)/);
});

test("default native dropdown spacing does not duplicate custom dropdown arrows", () => {
  const css = file("app/globals.css");
  assert.match(css, /select:not\(\.appearance-none\):not\(\[multiple\]\):not\(\[size\]\)/);
  assert.match(css, /padding-right: 3rem/);
  assert.match(css, /background-position: right 0\.75rem center/);
});
