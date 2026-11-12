import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ledger search finds transaction merchants and notes across months by default", () => {
  const filters = read("components/finance/transaction-filters.tsx");
  const search = read("components/transactions/transaction-search.tsx");
  const transactions = read("lib/transactions.ts");
  const page = read("app/(app)/transactions/page.tsx");

  assert.match(search, /placeholder="Cari nama toko atau catatan transaksi"/);
  assert.match(search, /Cari transaksi/);
  assert.match(filters, /const searchesAllMonths = Boolean\(currentQ\.trim\(\)\) && !searchParams\.has\("month"\)/);
  assert.match(filters, /showsAllMonths =[\s\S]*?searchesAllMonths/);
  assert.match(search, /router\.replace\(buildHref\(value\.trim\(\)\), \{ scroll: false \}\)/);
  assert.match(search, /type="text"/); // No second native clear X on desktop.
  assert.doesNotMatch(search, /type="search"/);
  assert.match(search, /inputMode="search"/);
  assert.match(search, /absolute inset-y-0 left-3 flex items-center justify-center/);
  assert.match(search, /border-primary\/40/);
  assert.doesNotMatch(filters, /placeholder="Cari nama toko atau catatan transaksi"/);
  assert.ok(page.indexOf("{gmailQueue}") < page.indexOf("<TransactionSearch />"));
  assert.ok(page.indexOf("<TransactionSearch />") < page.indexOf("<TransactionDayGroups groups={groups} />"));

  assert.match(transactions, /description\.ilike\.%\$\{escaped\}%,merchant\.ilike\.%\$\{escaped\}%/);
  assert.match(transactions, /\.eq\("user_id", userId\)/);
  assert.match(transactions, /if \(!requestedMonth && filters\.q\) return null/);
  assert.match(transactions, /return filters\.month \?\? currentMonth/);
  assert.match(page, /const listMonth = resolveListMonth\(resolvedSearchParams, filters, currentMonth\)/);
});

test("pending Gmail queue can collapse while preserving its count and approval actions", () => {
  const queue = read("components/transactions/gmail-pending-queue.tsx");

  assert.match(queue, /const \[expanded, setExpanded\] = useState\(true\)/);
  assert.match(queue, /setExpanded\(\(value\) => !value\)/);
  assert.match(queue, /aria-expanded=\{expanded\}/);
  assert.match(queue, /aria-controls="gmail-pending-details"/);
  assert.match(queue, /expanded \? "Tutup" : "Buka"/);
  assert.match(queue, /expanded \? "expand_less" : "expand_more"/);
  assert.match(queue, /\{total\} draft belum masuk saldo/);
  assert.match(queue, /\{expanded \? \(\s*<div id="gmail-pending-details"/);
  assert.match(queue, /Lihat semua \{total\} draft Gmail/);
  assert.match(queue, /ignoreImport\(id\)/);
  assert.match(queue, /data-pull-refresh-exclude/);
});
