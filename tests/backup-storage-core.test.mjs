import assert from "node:assert/strict";
import test from "node:test";
import { commitVerifiedSnapshot, sha256 } from "../lib/settings/backup-storage-core.mjs";

function fakeStorage({
  corruptDownload = false,
  failRead = false,
  failLatest = false,
} = {}) {
  const files = new Map([["user/latest.json", "PREVIOUS RECOVERABLE BACKUP"]]);
  const storage = {
    async upload(path, text, options) {
      if (failLatest && path === "user/latest.json") {
        return { error: { message: "simulated storage failure" } };
      }
      if (!options.upsert && files.has(path)) {
        return { error: { message: "already exists" } };
      }
      files.set(path, text);
      return { error: null };
    },
    async download(path) {
      if (failRead) return { data: null, error: { message: "unreadable" } };
      const text = files.get(path);
      if (!text) return { data: null, error: { message: "not found" } };
      return { data: new Blob([corruptDownload ? text + "corruption" : text]), error: null };
    },
  };
  return { files, storage };
}

const path = "user/snapshots/2026-11-02T11-00-00-000Z-id.json";
const latest = "user/latest.json";
const content = '{"format":"budgetku-backup","version":1}';
const validate = (s) => { assert.equal(s, content); };

test("publishes verified immutable backup and updates latest only after read-back", async () => {
  const { files, storage } = fakeStorage();
  const result = await commitVerifiedSnapshot(storage, path, latest, content, validate);
  assert.equal(files.get(path), content);
  assert.equal(files.get(latest), content);
  assert.equal(result.sha256, sha256(content));
});
test("failure reading stored snapshot preserves the previous latest", async () => {
  const { files, storage } = fakeStorage({ failRead: true });
  await assert.rejects(commitVerifiedSnapshot(storage, path, latest, content, validate), /read back/);
  assert.equal(files.get(latest), "PREVIOUS RECOVERABLE BACKUP");
  assert.equal(files.get(path), content);
});
test("corrupted snapshot cannot replace a previous valid latest", async () => {
  const { files, storage } = fakeStorage({ corruptDownload: true });
  await assert.rejects(commitVerifiedSnapshot(storage, path, latest, content, validate), /checksum/);
  assert.equal(files.get(latest), "PREVIOUS RECOVERABLE BACKUP");
});
test("failed latest pointer upload preserves the new verified snapshot", async () => {
  const { files, storage } = fakeStorage({ failLatest: true });
  await assert.rejects(commitVerifiedSnapshot(storage, path, latest, content, validate), /latest pointer/);
  assert.equal(files.get(latest), "PREVIOUS RECOVERABLE BACKUP");
  assert.equal(files.get(path), content);
});
test("a failed content validator prevents publication to latest", async () => {
  const { files, storage } = fakeStorage();
  await assert.rejects(
    commitVerifiedSnapshot(storage, path, latest, content, () => { throw new Error("invalid ownership"); }),
    /invalid ownership/,
  );
  assert.equal(files.get(latest), "PREVIOUS RECOVERABLE BACKUP");
});
