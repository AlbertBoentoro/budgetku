import { createHash } from "node:crypto";

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Two-stage, non-destructive archive publication. An immutable file must pass
 * a read-back/hash check before the mutable latest pointer is replaced.
 *
 * Storage adapter: Supabase Storage's upload/download methods.
 * validate must throw for invalid JSON or ownership.
 */
export async function commitVerifiedSnapshot(storage, snapshotPath, latestPath, text, validate) {
  const { error: uploadError } = await storage.upload(snapshotPath, text, {
    contentType: "application/json",
    upsert: false,
  });
  if (uploadError) throw new Error("Immutable backup upload failed.");

  const { data: saved, error: downloadError } = await storage.download(snapshotPath);
  if (downloadError || !saved) throw new Error("Immutable backup cannot be read back.");
  const reread = await saved.text();
  if (sha256(reread) !== sha256(text)) {
    throw new Error("Immutable backup checksum mismatch.");
  }
  validate(reread);

  const { error: latestError } = await storage.upload(latestPath, text, {
    contentType: "application/json",
    upsert: true,
  });
  if (latestError) throw new Error("Immutable backup saved, but latest pointer update failed.");
  return { sha256: sha256(text) };
}
