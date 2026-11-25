// Match the ledger's UTC date grouping, then order by actual recording time.
// Manual transactions store a date at midnight; adjustments carry their full
// audit timestamp in transaction_at. Comparing those raw values would pin
// adjustments above transactions recorded later on the same day.
type LedgerOrderRow = {
  transaction_at: string;
  created_at?: string | null;
  id: string;
};

function dayKey(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

export function compareLedgerRows(a: LedgerOrderRow, b: LedgerOrderRow): number {
  const byDay = dayKey(b.transaction_at).localeCompare(dayKey(a.transaction_at));
  if (byDay !== 0) return byDay;

  const aRecorded = Date.parse(a.created_at ?? a.transaction_at);
  const bRecorded = Date.parse(b.created_at ?? b.transaction_at);
  const byRecorded = bRecorded - aRecorded;
  if (Number.isFinite(byRecorded) && byRecorded !== 0) return byRecorded;
  return b.id.localeCompare(a.id);
}
