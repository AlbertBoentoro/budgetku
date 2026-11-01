/**
 * Read all RLS-scoped rows without silent PostgREST max_rows truncation.
 * Caller MUST use a deterministic unique order (normally .order("id"))
 * before .range(from, to). Financial aggregates must never sum only page one.
 *
 * Page size is deliberately below the common Supabase Data API 1,000 row cap.
 * For very large ledgers this should eventually be replaced by DB aggregates.
 */
export type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(`Pagination query failed: ${error.message}`);
    if (data === null) throw new Error("Pagination query returned no data.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
