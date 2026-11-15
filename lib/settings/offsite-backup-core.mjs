// Provider-neutral, SERVER-ONLY primitive. No storage provider, credentials,
// cron wiring, or production upload is enabled by importing this module.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const OFFSITE_FORMAT = "budgetku-offsite-v1";
const SNAPSHOT_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{32}\.json$/i;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PLAIN_BYTES = 10 * 1024 * 1024;

function ensureIdentity(userId, snapshot) {
  if (typeof userId !== "string" || !USER_ID.test(userId) ||
      typeof snapshot !== "string" || !SNAPSHOT_NAME.test(snapshot)) {
    throw new Error("Offsite backup identity is invalid.");
  }
}

function ensureKey(key) {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) {
    throw new Error("Offsite encryption requires a 32-byte secret key.");
  }
  return Buffer.from(key);
}

const digest = (value) => createHash("sha256").update(value).digest();
const encode = (value) => Buffer.from(value).toString("base64");

function decodeStrict(value, expectedLength = null) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) ||
      value.length % 4 !== 0) {
    throw new Error("Malformed encrypted backup encoding.");
  }
  const bytes = Buffer.from(value, "base64");
  if (encode(bytes) !== value || (expectedLength !== null && bytes.length !== expectedLength)) {
    throw new Error("Malformed encrypted backup encoding.");
  }
  return bytes;
}

function authenticatedContext(userId, snapshot) {
  return Buffer.from(JSON.stringify({ format: OFFSITE_FORMAT, userId, snapshot }), "utf8");
}

export function offsiteObjectKey(userId, snapshot) {
  ensureIdentity(userId, snapshot);
  return "budgetku/" + userId + "/snapshots/" + snapshot + ".enc";
}

export function encryptOffsiteSnapshot({ text, userId, snapshot, key }) {
  ensureIdentity(userId, snapshot);
  const secret = ensureKey(key);
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty or invalid offsite backup.");
  }
  const data = Buffer.from(text, "utf8");
  if (data.length > MAX_PLAIN_BYTES) throw new Error("Offsite backup exceeds size limit.");
  // The authenticated DB/backup service must validate backup JSON ownership
  // with inspectBackupJson before calling this isolated encryption primitive.
  JSON.parse(text);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, nonce, { authTagLength: 16 });
  cipher.setAAD(authenticatedContext(userId, snapshot));
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return {
    format: OFFSITE_FORMAT,
    userId,
    snapshot,
    cipher: "AES-256-GCM",
    nonce: encode(nonce),
    ciphertext: encode(ciphertext),
    tag: encode(cipher.getAuthTag()),
    sha256: digest(data).toString("hex"),
  };
}

export function decryptOffsiteSnapshot(envelope, { userId, snapshot, key }) {
  ensureIdentity(userId, snapshot);
  const secret = ensureKey(key);
  if (!envelope || envelope.format !== OFFSITE_FORMAT ||
      envelope.cipher !== "AES-256-GCM" ||
      envelope.userId !== userId || envelope.snapshot !== snapshot ||
      typeof envelope.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(envelope.sha256)) {
    throw new Error("Offsite backup identity or format mismatch.");
  }
  const nonce = decodeStrict(envelope.nonce, 12);
  const tag = decodeStrict(envelope.tag, 16);
  const ciphertext = decodeStrict(envelope.ciphertext);
  if (ciphertext.length > MAX_PLAIN_BYTES + 16) throw new Error("Encrypted backup too large.");
  const decipher = createDecipheriv("aes-256-gcm", secret, nonce, { authTagLength: 16 });
  decipher.setAAD(authenticatedContext(userId, snapshot));
  decipher.setAuthTag(tag);
  // Authentication failure throws: never return partially decrypted data.
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const actual = digest(plaintext);
  const claimed = Buffer.from(envelope.sha256, "hex");
  if (!timingSafeEqual(actual, claimed)) throw new Error("Offsite backup checksum mismatch.");
  return plaintext.toString("utf8");
}

/**
 * Storage adapter contract:
 * - putImmutableObject(key, text): create-if-absent only (no overwrite);
 * - getObject(key): fetch exact bytes from independent private storage.
 * This intentionally DOES NOT provide a real cloud adapter, so a provider
 * and separate credentials must be chosen and verified before activation.
 */
export async function replicateAndVerifyOffsiteSnapshot({
  text, userId, snapshot, key, storage,
}) {
  if (typeof storage?.putImmutableObject !== "function" ||
      typeof storage?.getObject !== "function") {
    throw new Error("Independent offsite storage is not configured.");
  }
  const name = offsiteObjectKey(userId, snapshot);
  const envelope = encryptOffsiteSnapshot({ text, userId, snapshot, key });
  await storage.putImmutableObject(name, JSON.stringify(envelope));
  const fetched = await storage.getObject(name);
  if (typeof fetched !== "string") throw new Error("Offsite readback failed.");
  const recovered = decryptOffsiteSnapshot(JSON.parse(fetched), { userId, snapshot, key });
  if (recovered !== text) throw new Error("Offsite roundtrip mismatch.");
  return { objectKey: name, sha256: envelope.sha256, verified: true };
}
