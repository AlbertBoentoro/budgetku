import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { inspectBackupJson, isBackupSnapshotFilename } from "./backup-safety";

const BUCKET = "budgetku-backups";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
type BackupClient = SupabaseClient<Database>;

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildSnapshotFilename(now: Date, id: string): string {
  const timestamp = now.toISOString().replaceAll(":", "-").replace(".", "-");
  const filename = `${timestamp}-${id}.json`;
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

  const snapshot = buildSnapshotFilename(new Date(), randomUUID());
  const filePath = `${userId}/snapshots/${snapshot}`;
  const storage = client.storage.from(BUCKET);

  const { error: uploadError } = await storage.upload(filePath, text, {
    contentType: "application/json",
    upsert: false,
  });
  if (uploadError) throw new Error(`Snapshot upload failed: ${uploadError.message}`);

  // A storage ACK alone is not sufficient evidence of a usable backup.
  const { data: saved, error: downloadError } = await storage.download(filePath);
  if (downloadError || !saved) {
    throw new Error("Snapshot cannot be read back; latest backup was preserved.");
  }
  const reread = await saved.text();
  if (digest(reread) !== digest(text)) {
    throw new Error("Snapshot content mismatch; latest backup was preserved.");
  }
  inspectBackupJson(reread, userId);

  // Only after integrity checks pass do we update the familiar download path.
  const { error: latestError } = await storage.upload(`${userId}/latest.json`, text, {
    contentType: "application/json",
    upsert: true,
  });
  if (latestError) {
    // The verified immutable snapshot remains available via the history API.
    throw new Error("Snapshot verified but latest pointer could not be updated.");
  }
  return { snapshot, sha256: digest(text) };
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
  const inspection = inspectBackupJson(content, userId);
  return { text: content, inspection, sha256: digest(content) };
}
