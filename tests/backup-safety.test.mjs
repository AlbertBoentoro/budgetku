import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_TABLE_KEYS,
  inspectBackupJson,
  isBackupSnapshotFilename,
} from "../lib/settings/backup-safety.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const data = Object.fromEntries(BACKUP_TABLE_KEYS.map((key) => [key, []]));
  return {
    format: "budgetku-backup",
    version: 1,
    generatedAt: "2026-11-02T04:00:00.000Z",
    data: { ...data, accounts: [{ id: "cash1", user_id: owner }], preferences: null },
  };
}

test("accepts an intact v1 snapshot and computes table counts", () => {
  const result = inspectBackupJson(JSON.stringify(fixture()), owner);
  assert.equal(result.counts.accounts, 1);
  assert.equal(result.counts.transactions, 0);
  assert.equal(result.version, 1);
});
test("allows shared system categories, but refuses someone else's private rows", () => {
  const obj = fixture();
  obj.data.categories = [{ id: "global", user_id: null }];
  assert.equal(inspectBackupJson(JSON.stringify(obj), owner).counts.categories, 1);
  obj.data.accounts = [{ id: "cash1", user_id: other }];
  assert.throws(() => inspectBackupJson(JSON.stringify(obj), owner), /pengguna lain/);
});
test("rejects corrupted JSON, unknown versions and missing tables", () => {
  assert.throws(() => inspectBackupJson("{", owner), /bukan JSON/);
  const obj = fixture();
  obj.version = 2;
  assert.throws(() => inspectBackupJson(JSON.stringify(obj), owner), /Format atau versi/);
  obj.version = 1;
  delete obj.data.budgets;
  assert.throws(() => inspectBackupJson(JSON.stringify(obj), owner), /budgets/);
});
test("rejects duplicate IDs instead of silently trusting incomplete financial records", () => {
  const obj = fixture();
  obj.data.accounts.push({ id: "cash1", user_id: owner });
  assert.throws(() => inspectBackupJson(JSON.stringify(obj), owner), /ID ganda/);
});
test("rejects a snapshot without a valid timestamp", () => {
  const obj = fixture();
  obj.generatedAt = "invalid-date";
  assert.throws(() => inspectBackupJson(JSON.stringify(obj), owner), /Tanggal/);
});
test("rejects modified, cross-user or path-traversal snapshot identifiers", () => {
  assert.ok(isBackupSnapshotFilename("2026-11-02T05-12-17-341Z-4eaccf54-f752-4f1b-a00a-bf9a54bd5e7b-54fba202098f61d6ddc8e90258c55f92.json"));
  assert.equal(isBackupSnapshotFilename("../latest.json"), false);
  assert.equal(isBackupSnapshotFilename("latest.json"), false);
  assert.equal(isBackupSnapshotFilename("../../other/snapshots/foo.json"), false);
});
