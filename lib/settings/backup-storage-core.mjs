import { createHash } from "node:crypto";

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function hasStatus(error, status) {
  return String(error?.status ?? error?.statusCode ?? "") === String(status);
}

function isMissingObject(error) {
  return hasStatus(error, 404) || error?.code === "NoSuchKey" ||
    error?.errorCode === "NoSuchKey" || error?.error === "NoSuchKey";
}

function isAlreadyExists(error) {
  return hasStatus(error, 409) ||
    ["KeyAlreadyExists", "ResourceAlreadyExists"].includes(error?.code) ||
    ["KeyAlreadyExists", "ResourceAlreadyExists"].includes(error?.error);
}

async function readStoredText(storage, path, { allowMissing = false } = {}) {
  const { data, error } = await storage.download(path);
  if (error) {
    if (allowMissing && isMissingObject(error)) return null;
    throw new Error("Backup storage read failed.");
  }
  if (!data) throw new Error("Backup storage returned no content.");
  return data.text();
}

/**
 * Deterministic, versioned snapshot filename for a previous latest.json.
 * Identical legacy content always maps to the same path, including retries.
 * This avoids overwriting previous archives and never depends on a transient
 * in-memory marker or a listing of the snapshots directory.
 */
export function preservedLatestPath(latestPath, previousText) {
  if (!latestPath.endsWith("/latest.json")) throw new Error("Invalid latest backup path.");
  const backup = JSON.parse(previousText);
  const timestamp = new Date(backup.generatedAt).toISOString().replaceAll(":", "-").replace(".", "-");
  const digest = sha256(previousText);
  const deterministicUuid =
    `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return `${latestPath.slice(0, -"latest.json".length)}snapshots/${timestamp}-${deterministicUuid}-${digest.slice(0, 32)}.json`;
}

async function verifyExactCopy(storage, path, expected, validate) {
  const reread = await readStoredText(storage, path);
  if (sha256(reread) !== sha256(expected)) throw new Error("Immutable backup checksum mismatch.");
  validate(reread);
}

/**
 * Preserve the already-existing latest.json as its own immutable snapshot
 * before any new version can overwrite it. No deletion is ever performed.
 * When the deterministic path already exists, verify it is byte-identical:
 * this makes retries safe and rejects corrupted/colliding archive objects.
 */
async function preservePreviousLatest(storage, latestPath, previousText, validate) {
  validate(previousText);
  const archivePath = preservedLatestPath(latestPath, previousText);
  const { error } = await storage.upload(archivePath, previousText, {
    contentType: "application/json",
    upsert: false,
  });
  if (error && !isAlreadyExists(error)) {
    throw new Error("Previous backup preservation failed.");
  }
  await verifyExactCopy(storage, archivePath, previousText, validate);
}

/**
 * Non-destructive publication of new backups. First archive the previous
 * latest.json (including pre-versioning files), then publish the new snapshot.
 * Only then can latest.json be updated.
 *
 * A second latest read catches updates made while the new snapshot was being
 * prepared. Supabase Storage does not expose an atomic compare-and-swap here;
 * a tiny race between that read and upload can still reorder latest pointers.
 * All recoverable content is preserved in immutable snapshots regardless.
 */
export async function commitVerifiedSnapshot(storage, snapshotPath, latestPath, text, validate) {
  validate(text);
  const baseline = await readStoredText(storage, latestPath, { allowMissing: true });
  if (baseline !== null && sha256(baseline) !== sha256(text)) {
    await preservePreviousLatest(storage, latestPath, baseline, validate);
  }

  const { error: uploadError } = await storage.upload(snapshotPath, text, {
    contentType: "application/json",
    upsert: false,
  });
  if (uploadError) throw new Error("Immutable backup upload failed.");

  await verifyExactCopy(storage, snapshotPath, text, validate);

  const latestNow = await readStoredText(storage, latestPath, { allowMissing: true });
  if ((latestNow === null ? null : sha256(latestNow)) !==
      (baseline === null ? null : sha256(baseline))) {
    throw new Error("Latest backup changed during publication; retry.");
  }

  const { error: latestError } = await storage.upload(latestPath, text, {
    contentType: "application/json",
    upsert: true,
  });
  if (latestError) throw new Error("Immutable backup saved, but latest pointer update failed.");
  return { sha256: sha256(text) };
}
