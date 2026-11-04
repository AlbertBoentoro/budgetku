import { randomUUID } from "node:crypto";
import { commitVerifiedSnapshot, sha256 } from "./backup-storage-core.mjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { inspectBackupJson, isBackupSnapshotFilename } from "./backup-safety";

const BUCKET = "budgetku-backups";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
type BackupClient = SupabaseClient<Database>;

export function buildSnapshotFilename(now: Date, id: string, hash: string): string {
  const timestamp = now.toISOString().replaceAll(":", "-").replace(".", "-");
  const filename = `${timestamp}-${id}-${hash.slice(0, 32)}.json`;
  if (!isBackupSnapshotFilename(filename)) throw new Error("Invalid snapshot name.");
  return filename;
}

/**
 * Always store an immutable, verified snapshot BEFORE refreshing latest.json.
 * A failed or corrupted latest write must not erase the last recoverable copy.
 * Existing snapshots are never automatically deleted.
 */
export async function storeVerifiedBackup(
  client: BackupClient,
  userId: string,
  backup: unknown,
): Promise<{ snapshot: string; sha256: string }> {
  const text = JSON.stringify(backup);
  const size = Buffer.byteLength(text, "utf8");
  if (size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 10 MB limit.");
  inspectBackupJson(text, userId);

  const storage = client.storage.from(BUCKET);
  // Two writers (manual backup / scheduled backup / safety snapshot) may
  // race on latest.json. The core publisher fails closed and keeps immutable
  // snapshots intact. Retry ONLY that specific optimistic-concurrency error,
  // with a fresh immutable path and full checksum verification every time.
  // Never treat a storage error as success or overwrite an existing snapshot.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const snapshot = buildSnapshotFilename(new Date(), randomUUID(), sha256(text));
    const filePath = `${userId}/snapshots/${snapshot}`;
    try {
      const verified = await commitVerifiedSnapshot(
        storage,
        filePath,
        `${userId}/latest.json`,
        text,
        (value: string) => inspectBackupJson(value, userId),
      );
      return { snapshot, sha256: verified.sha256 };
    } catch (error) {
      if (!(error instanceof Error) ||
          error.message !== "Latest backup changed during publication; retry." ||
          attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 175));
    }
  }
  throw new Error("Verified backup could not be published.");
}

export async function fetchVerifiedBackup(
  client: BackupClient,
  userId: string,
  snapshot?: string,
): Promise<{ text: string; inspection: ReturnType<typeof inspectBackupJson>; sha256: string }> {
  if (snapshot !== undefined && !isBackupSnapshotFilename(snapshot)) {
    throw new Error("Invalid snapshot filename.");
  }
  const path = snapshot
    ? `${userId}/snapshots/${snapshot}`
    : `${userId}/latest.json`;
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("Backup download failed.");
  const content = await data.text();
  if (Buffer.byteLength(content, "utf8") > MAX_BACKUP_BYTES) {
    throw new Error("Backup size exceeds the configured limit.");
  }
  if (snapshot) {
    const expectedHash = snapshot.match(/-([a-f0-9]{32})\.json$/i)?.[1];
    if (!expectedHash || sha256(content).slice(0, 32) !== expectedHash.toLowerCase()) {
      throw new Error("Snapshot checksum mismatch.");
    }
  }
  const inspection = inspectBackupJson(content, userId);
  return { text: content, inspection, sha256: sha256(content) };
}
