// WIB has no daylight-saving time. Compare actual generated backup instants,
// not UTC calendar dates: midnight WIB is 17:00 UTC on the previous day.
export function wibDay(value: string): string | null {
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return null;
  return new Date(instant + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function hasBackupForWibDay(lastBackupAt: string | null, now: string): boolean {
  if (!lastBackupAt) return false;
  const lastDay = wibDay(lastBackupAt);
  const today = wibDay(now);
  return Boolean(lastDay && today && lastDay === today);
}
