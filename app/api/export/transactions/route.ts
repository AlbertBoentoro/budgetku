import { csvNumber, csvText, toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { formatTransactionTypeLabel } from "@/lib/transactions";

/**
 * GET /api/export/transactions: download the signed-in user's transactions
 * as CSV (read-only). Uses the anon-key server client, so RLS plus the
 * explicit user_id filter scope every row to the user. createClient() reads
 * cookies(), which makes this handler request-time under Cache Components;
 * no route segment config is needed.
 */

// PostgREST caps a response at 1000 rows by default, so every query pages.
const PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

// Fetch pages [from, from + PAGE_SIZE - 1] until a short page. The caller's
// query must have a total order so pages never overlap or skip rows.
async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return { rows, error: null };
  }
}

// UTC date-only key, same basis as dayKeyOf in lib/transactions.ts (not
// exported there). Unparseable values fall back to the raw string.
function toDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  recurring: "Berulang",
  email: "Gmail",
};

const HEADER = [
  "tanggal",
  "tipe",
  "jumlah",
  "kategori",
  "rekening",
  "rekening_tujuan",
  "catatan",
  "merchant",
  "sumber",
];

// Filename date labels the download day for an Indonesian user (WIB).
const filenameDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return textResponse("Sesi berakhir. Silakan masuk kembali.", 401);
  }

  // Archived accounts/categories are included so old rows still resolve.
  // Categories are the user's own plus system ones (user_id IS NULL).
  const [accounts, categories, transactions] = await Promise.all([
    fetchAllPages<{ id: string; name: string }>((from, to) =>
      supabase
        .from("accounts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<{ id: string; name: string }>((from, to) =>
      supabase
        .from("categories")
        .select("id, name")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    // Oldest first; id breaks ties so offset pages are stable.
    fetchAllPages((from, to) =>
      supabase
        .from("transactions")
        .select(
          "transaction_at, transaction_type, amount, category_id, account_id, destination_account_id, description, merchant, source",
        )
        .eq("user_id", user.id)
        .order("transaction_at", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  // Any failure returns an error, never a partial file that looks complete.
  const failure = accounts.error ?? categories.error ?? transactions.error;
  if (failure) {
    console.error("CSV export failed:", failure);
    return textResponse("Gagal mengekspor transaksi. Coba lagi.", 500);
  }

  const accountNameById = new Map(accounts.rows.map((a) => [a.id, a.name]));
  const categoryNameById = new Map(
    categories.rows.map((c) => [c.id, c.name]),
  );

  const rows = transactions.rows.map((t) => [
    csvText(toDateOnly(t.transaction_at)),
    csvText(formatTransactionTypeLabel(t.transaction_type)),
    csvNumber(t.amount),
    csvText(t.category_id ? categoryNameById.get(t.category_id) : null),
    csvText(accountNameById.get(t.account_id)),
    csvText(
      t.destination_account_id
        ? accountNameById.get(t.destination_account_id)
        : null,
    ),
    csvText(t.description),
    csvText(t.merchant),
    csvText(SOURCE_LABELS[t.source] ?? t.source),
  ]);

  const csv = toCsv(HEADER.map(csvText), rows);
  const filename = `budgetku-transaksi-${filenameDateFormatter.format(new Date())}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
