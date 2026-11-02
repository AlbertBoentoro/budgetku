/**
 * Strict, read-only checks for Budgetku v1 backup files.
 * Validating a backup never writes accounts, transactions or settings.
 * This is a recovery preflight, NOT a data-restore operation.
 */
export const BACKUP_TABLE_KEYS = [
  "accounts", "budgets", "budgetItems", "categories", "transactions",
  "recurringTransactions", "financialGoals", "goalContributions", "merchantRules",
] as const;

export type BackupTableKey = (typeof BACKUP_TABLE_KEYS)[number];
export type BackupInspection = {
  generatedAt: string;
  format: "budgetku-backup";
  version: 1;
  counts: Record<BackupTableKey, number>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function inspectBackupJson(
  text: string,
  expectedUserId?: string,
): BackupInspection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File backup bukan JSON yang valid.");
  }
  if (!isRecord(parsed) || parsed.format !== "budgetku-backup" || parsed.version !== 1) {
    throw new Error("Format atau versi backup tidak dikenali.");
  }
  const date = parsed.generatedAt;
  if (typeof date !== "string" || !Number.isFinite(Date.parse(date))) {
    throw new Error("Tanggal pembuatan backup tidak valid.");
  }
  if (!isRecord(parsed.data)) throw new Error("Isi backup tidak lengkap.");

  const counts = {} as Record<BackupTableKey, number>;
  for (const key of BACKUP_TABLE_KEYS) {
    const rows = parsed.data[key];
    if (!Array.isArray(rows)) throw new Error(`Tabel ${key} tidak tersedia dalam backup.`);
    const ids = new Set<string>();
    for (const row of rows) {
      if (!isRecord(row) || typeof row.id !== "string" || !row.id) {
        throw new Error(`Baris tabel ${key} tidak memiliki ID yang valid.`);
      }
      if (ids.has(row.id)) throw new Error(`Ada ID ganda dalam tabel ${key}.`);
      ids.add(row.id);
      // Shared system categories can have user_id=null; all other entities
      // in the export must be owned by the authenticated user.
      if (expectedUserId && !(key === "categories" && row.user_id === null)
          && row.user_id !== expectedUserId) {
        throw new Error(`Tabel ${key} berisi catatan milik pengguna lain.`);
      }
    }
    counts[key] = rows.length;
  }

  // Preferences are allowed to be null when a settings row doesn't exist.
  const settings = parsed.data.preferences;
  if (settings !== null && settings !== undefined && !isRecord(settings)) {
    throw new Error("Preferensi backup tidak valid.");
  }
  return { generatedAt: date, format: "budgetku-backup", version: 1, counts };
}

/** Restrict snapshot access to a generated filename, never a client-supplied path. */
export function isBackupSnapshotFilename(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i.test(value);
}
