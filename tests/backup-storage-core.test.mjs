import assert from "node:assert/strict";
import test from "node:test";
import {
  commitVerifiedSnapshot,
  preservedLatestPath,
  sha256,
} from "../lib/settings/backup-storage-core.mjs";
import { isBackupSnapshotFilename } from "../lib/settings/backup-safety.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const latest = "user/latest.json";
const newPath = "user/snapshots/2026-11-02T11-00-00-000Z-id.json";
const older = JSON.stringify({
  format: "budgetku-backup", version: 1, generatedAt: "2026-11-01T13:12:31.124Z",
  data: { accounts: [{ id: "one", user_id: owner }] },
});
const newer = JSON.stringify({
  format: "budgetku-backup", version: 1, generatedAt: "2026-11-02T11:00:00.000Z",
  data: { accounts: [{ id: "two", user_id: owner }] },
});
const competing = JSON.stringify({
  format: "budgetku-backup", version: 1, generatedAt: "2026-11-02T12:00:00.000Z",
  data: { accounts: [{ id: "three", user_id: owner }] },
});
const validate = (text) => {
  const obj = JSON.parse(text);
  assert.equal(obj.format, "budgetku-backup");
  assert.equal(obj.version, 1);
  assert.ok(Number.isFinite(Date.parse(obj.generatedAt)));
  for (const item of obj.data.accounts) assert.equal(item.user_id, owner);
};

function fakeStorage({
  original = older,
  failRead = false,
  failLegacyUpload = false,
  failLatestUpload = false,
  corruptSnapshot = false,
  changeLatestMidway = false,
  missingError = { status: 404, message: "Not found" },
} = {}) {
  const files = new Map(original === null ? [] : [[latest, original]]);
  const uploads = [];
  let didRace = false;
  const storage = {
    async upload(path, text, options) {
      uploads.push(path);
      if (failLegacyUpload && path === preservedLatestPath(latest, older)) {
        return { error: { status: 503, message: "archive unavailable" } };
      }
      if (failLatestUpload && path === latest) {
        return { error: { status: 503, message: "latest write failure" } };
      }
      if (!options.upsert && files.has(path)) {
        return { error: { status: 409, message: "already exists" } };
      }
      files.set(path, text);
      if (changeLatestMidway && path === newPath && !didRace) {
        files.set(latest, competing);
        didRace = true;
      }
      return { error: null };
    },
    async download(path) {
      if (failRead) return { data: null, error: { status: 503, message: "unreadable" } };
      const text = files.get(path);
      if (text === undefined) return { data: null, error: missingError };
      return {
        data: new Blob([corruptSnapshot && path !== latest ? text + "tampered" : text]),
        error: null,
      };
    },
  };
  return { files, uploads, storage };
}

test("legacy archive has stable name conforming to snapshot validator", () => {
  const path = preservedLatestPath(latest, older);
  assert.ok(path.startsWith("user/snapshots/"));
  assert.ok(isBackupSnapshotFilename(path.split("/").at(-1)));
  assert.equal(preservedLatestPath(latest, older), path);
  assert.ok(path.endsWith(sha256(older).slice(0, 32) + ".json"));
});

test("archives existing latest BEFORE replacing it; retains two recoverable copies", async () => {
  const { files, uploads, storage } = fakeStorage();
  const result = await commitVerifiedSnapshot(storage, newPath, latest, newer, validate);
  const archive = preservedLatestPath(latest, older);
  assert.equal(uploads[0], archive);
  assert.equal(files.get(archive), older);
  assert.equal(files.get(newPath), newer);
  assert.equal(files.get(latest), newer);
  assert.equal(result.sha256, sha256(newer));
});

test("fresh account without latest creates snapshot and latest normally", async () => {
  const { files, uploads, storage } = fakeStorage({ original: null });
  await commitVerifiedSnapshot(storage, newPath, latest, newer, validate);
  assert.deepEqual(uploads, [newPath, latest]);
  assert.equal(files.get(latest), newer);
});

test("migration preservation failure leaves old latest intact", async () => {
  const { files, storage } = fakeStorage({ failLegacyUpload: true });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate), /preservation failed/);
  assert.equal(files.get(latest), older);
  assert.equal(files.has(newPath), false);
});

test("archive read-back corruption blocks overwrite of latest", async () => {
  const { files, storage } = fakeStorage({ corruptSnapshot: true });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate), /checksum/);
  assert.equal(files.get(latest), older);
});

test("retry after failed latest update verifies pre-existing legacy archive", async () => {
  const { files, storage } = fakeStorage({ failLatestUpload: true });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate), /latest pointer/);
  assert.equal(files.get(latest), older);
  const archive = preservedLatestPath(latest, older);
  assert.equal(files.get(archive), older);
  const alternateStorage = fakeStorage();
  alternateStorage.files.clear();
  for (const [k, v] of files) alternateStorage.files.set(k, v);
  await commitVerifiedSnapshot(
    alternateStorage.storage, "user/snapshots/a-second-immutable-file.json",
    latest, newer, validate,
  );
  assert.equal(alternateStorage.files.get(latest), newer);
  assert.equal(alternateStorage.files.get(archive), older);
});

test("preexisting mismatched archive rejects instead of overwriting either version", async () => {
  const { files, storage } = fakeStorage();
  files.set(preservedLatestPath(latest, older), competing);
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate), /checksum/);
  assert.equal(files.get(latest), older);
  assert.equal(files.has(newPath), false);
});

test("invalid legacy backup aborts replacement to preserve legacy evidence", async () => {
  const { files, storage } = fakeStorage({ original: "not-json" });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate));
  assert.equal(files.get(latest), "not-json");
});

test("unknown storage download error is NOT treated as a missing legacy backup", async () => {
  const { files, storage } = fakeStorage({ original: null, missingError: { status: 403 } });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate), /read failed/);
  assert.equal(files.has(newPath), false);
});

test("a changed latest pointer during archiving cancels publication", async () => {
  const { files, storage } = fakeStorage({ changeLatestMidway: true });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate), /changed during publication/);
  assert.equal(files.get(latest), competing);
  assert.equal(files.get(preservedLatestPath(latest, older)), older);
  assert.equal(files.get(newPath), newer);
});

test("failed new snapshot read-back retains original latest and its archive", async () => {
  const { files, storage } = fakeStorage({ corruptSnapshot: true });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate));
  assert.equal(files.get(latest), older);
});

test("failure uploading latest retains previous latest and immutable archives", async () => {
  const { files, storage } = fakeStorage({ failLatestUpload: true });
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, newer, validate), /latest pointer/);
  assert.equal(files.get(latest), older);
  assert.equal(files.get(newPath), newer);
});

test("an invalid new snapshot cannot alter any existing backup", async () => {
  const { files, storage } = fakeStorage();
  await assert.rejects(commitVerifiedSnapshot(storage, newPath, latest, "{", validate));
  assert.equal(files.get(latest), older);
  assert.equal(files.size, 1);
});
