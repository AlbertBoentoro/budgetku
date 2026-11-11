import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { wibDay, hasBackupForWibDay } from "../lib/settings/backup-day.ts";

test("F-08: WIB date boundary is 17:00 UTC, not UTC midnight", () => {
  assert.equal(wibDay("2026-11-05T16:59:59.000Z"), "2026-11-05");
  assert.equal(wibDay("2026-11-05T17:00:00.000Z"), "2026-11-06");
  assert.equal(wibDay("not-a-time"), null);
});

test("F-08: skip verified backups made during the same Jakarta day", () => {
  const now = "2026-11-05T17:03:00.000Z";
  assert.equal(hasBackupForWibDay("2026-11-05T17:00:00.000Z", now), true);
  assert.equal(hasBackupForWibDay("2026-11-05T16:59:59.000Z", now), false);
  assert.equal(hasBackupForWibDay(null, now), false);
  assert.equal(hasBackupForWibDay("invalid", now), false);
});

test("F-08: cron checks the last successful backup before writing", () => {
  const cron = readFileSync(new URL("../app/api/cron/backup/route.ts", import.meta.url), "utf8");
  assert.match(cron, /select\("last_backup_at"\)/);
  assert.match(cron, /hasBackupForWibDay\(settings\?\.last_backup_at/);
  assert.match(cron, /backupsSkipped/);
  assert.doesNotMatch(cron, /storage\.remove\(/);
});
