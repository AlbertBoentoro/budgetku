// Normalization matches docs/sql/2026-11-account-name-uniqueness.sql.
// Do not include the account type: names must be unique across every type.
export function normalizeAccountName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Existing legacy duplicate names remain editable without forced renaming.
// Only a new normalized name needs a uniqueness lookup.
export function accountNameChanged(stored: string, next: string): boolean {
  return normalizeAccountName(stored) !== normalizeAccountName(next);
}
