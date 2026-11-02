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

  const snapshot = buildSnapshotFilename(new Date(), randomUUID(), sha256(text));
  const filePath = `${userId}/snapshots/${snapshot}`;
  const storage = client.storage.from(BUCKET);

  const verified = await commitVerifiedSnapshot(
    storage,
    filePath,
    `${userId}/latest.json`,
    text,
    (value: string) => inspectBackupJson(value, userId),
  );
  return { snapshot, sha256: verified.sha256 };
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
