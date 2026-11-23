import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("account row tapping directly opens its own transaction ledger", () => {
  const row = read("../components/accounts/account-row.tsx");
  assert.match(row, /href=\{\`\/transactions\?account=\$\{encodeURIComponent\(account\.id\)\}\`\}/);
  assert.match(row, /aria-label=\{\`Lihat riwayat transaksi \$\{account\.name\}\`\}/);
  assert.match(row, /Lihat riwayat transaksi/);
  assert.doesNotMatch(row, />\s*Riwayat transaksi\s*</);
});

test("account edit and destructive actions remain available only from the actions menu", () => {
  const row = read("../components/accounts/account-row.tsx");
  const edit = read("../app/(app)/accounts/[id]/edit/page.tsx");
  assert.match(row, /<DropdownMenu>/);
  assert.match(row, /href=\{\`\/accounts\/\$\{account\.id\}\/edit\`\}/);
  assert.match(row, /setAccountArchived\(account\.id, true\)/);
  assert.match(row, /deleteAccount\(account\.id\)/);
  assert.match(edit, /<AccountForm mode="edit"/);
  assert.doesNotMatch(edit, />\s*Riwayat transaksi\s*</);
});

test("budget category editing preserves the exact fields in the provided screenshot", () => {
  const item = read("../components/finance/budget-item-row.tsx");
  const edit = read("../app/(app)/budget/items/[id]/edit/page.tsx");
  const form = read("../components/finance/budget-item-form.tsx");
  assert.match(item, /href=\{historyHref\}/);
  assert.match(item, /\/budget\/items\/\$\{item\.id\}\/edit\?month=\$\{monthParam\}/);
  assert.match(edit, /<BudgetItemForm/);
  for (const label of ["Kategori pengeluaran", "Batas per bulan", "Catatan", "Simpan perubahan", "Batal"]) {
    assert.ok(form.includes(label), `Expected existing budget form field/action: ${label}`);
  }
});

test("no-login account demo uses isolated synthetic data and separate history and edit routes", () => {
  const landing = read("../app/testing/page.tsx");
  const accounts = read("../app/testing/accounts/page.tsx");
  const history = read("../app/testing/accounts/history/[accountId]/page.tsx");
  assert.match(landing, /href="\/testing\/accounts"/);
  assert.match(accounts, /isPublicTestingDemoAllowed\(\)/);
  assert.match(history, /isPublicTestingDemoAllowed\(\)/);
  assert.match(accounts, /\/testing\/accounts\/history\/\$\{account\.id\}/);
  assert.match(accounts, /href="\/testing\/accounts\/edit"/);
  assert.match(history, /await connection\(\)/);
  assert.match(history, /tx\.account_id === accountId \|\| tx\.destination_account_id === accountId/);
  for (const source of [accounts, history]) {
    assert.doesNotMatch(source, /createClient\(|@\/lib\/supabase\/server|from\("transactions"\)/);
  }
});
