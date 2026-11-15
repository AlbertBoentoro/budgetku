import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  OFFSITE_FORMAT,
  encryptOffsiteSnapshot,
  decryptOffsiteSnapshot,
  offsiteObjectKey,
  replicateAndVerifyOffsiteSnapshot,
} from "../lib/settings/offsite-backup-core.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const snapshot = "2026-11-15T13-00-00-000Z-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-0123456789abcdef0123456789abcdef.json";
const text = JSON.stringify({ ownerId: userId, transactions: [{ amount: 0.41, kind: "expense" }] });
const key = Buffer.alloc(32, 17); // synthetic test key only, never a production secret

test("offsite backup roundtrip preserves exact JSON bytes and fractional amount", () => {
  const first = encryptOffsiteSnapshot({ text, userId, snapshot, key });
  const second = encryptOffsiteSnapshot({ text, userId, snapshot, key });
  assert.equal(first.format, OFFSITE_FORMAT);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(decryptOffsiteSnapshot(first, { userId, snapshot, key }), text);
  assert.equal(JSON.parse(decryptOffsiteSnapshot(second, { userId, snapshot, key })).transactions[0].amount, 0.41);
  assert.ok(!JSON.stringify(first).includes('"amount":0.41'));
});

test("offsite backup fails closed on wrong key, owner, metadata and ciphertext", () => {
  const envelope = encryptOffsiteSnapshot({ text, userId, snapshot, key });
  assert.throws(() => decryptOffsiteSnapshot(envelope, { userId, snapshot, key: randomBytes(32) }));
  assert.throws(() => decryptOffsiteSnapshot(envelope, { userId: "22222222-2222-4222-8222-222222222222", snapshot, key }));
  assert.throws(() => decryptOffsiteSnapshot({ ...envelope, snapshot: "not-a-snapshot" }, { userId, snapshot, key }));
  assert.throws(() => decryptOffsiteSnapshot({ ...envelope, sha256: "0".repeat(64) }, { userId, snapshot, key }));
  const bytes = Buffer.from(envelope.ciphertext, "base64");
  bytes[0] ^= 0xff;
  assert.throws(() => decryptOffsiteSnapshot({ ...envelope, ciphertext: bytes.toString("base64") }, { userId, snapshot, key }));
  assert.throws(() => decryptOffsiteSnapshot({ ...envelope, nonce: "not-base64" }, { userId, snapshot, key }));
});

test("offsite path and key material are validated before encryption", () => {
  assert.match(offsiteObjectKey(userId, snapshot), /^budgetku\/11111111-.+\/snapshots\/.+\.enc$/);
  assert.throws(() => offsiteObjectKey("../outside", snapshot));
  assert.throws(() => offsiteObjectKey(userId, "../../secrets.json"));
  assert.throws(() => encryptOffsiteSnapshot({ text, userId, snapshot, key: Buffer.alloc(16) }));
  assert.throws(() => encryptOffsiteSnapshot({ text: "invalid-json", userId, snapshot, key }));
});

test("independent adapter must read the saved bytes back and verify before success", async () => {
  const objects = new Map();
  const adapter = {
    async putImmutableObject(path, contents) {
      if (objects.has(path)) throw new Error("Immutable object already exists.");
      objects.set(path, contents);
    },
    async getObject(path) { return objects.get(path) ?? null; },
  };
  const result = await replicateAndVerifyOffsiteSnapshot({ text, userId, snapshot, key, storage: adapter });
  assert.equal(result.verified, true);
  assert.ok(objects.has(result.objectKey));
  await assert.rejects(replicateAndVerifyOffsiteSnapshot({ text, userId, snapshot, key, storage: adapter }),
    /already exists/);
  await assert.rejects(replicateAndVerifyOffsiteSnapshot({
    text, userId, snapshot, key, storage: {
      async putImmutableObject() {},
      async getObject() { return '{"format":"corrupted"}'; },
    },
  }));
  await assert.rejects(replicateAndVerifyOffsiteSnapshot({ text, userId, snapshot, key, storage: {} }),
    /not configured/);
});
