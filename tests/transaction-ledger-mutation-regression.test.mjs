import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Transaksi ledger pages through all filtered rows without a silent 1,000-row cap", () => {
  const page = read("app/(app)/transactions/page.tsx");
  const query = read("lib/transactions.ts");
  const dashboard = read("app/(app)/dashboard/page.tsx");

  // The paging utility has behavioral 0 / 500 / 1,000 / 2,026 row tests
  // in fetch-all-pages.test.mjs. Keep the ledger wired into that utility.
  assert.match(page, /import \{ fetchAllPages \} from "@\/lib\/supabase\/fetch-all-pages"/);
  assert.match(page, /await fetchAllPages\(\(from, to\) =>[\s\S]*?buildTransactionListQuery\([\s\S]*?\.range\(from, to\)/);
  assert.match(query, /\.order\("transaction_at", \{ ascending: false \}\)[\s\S]*?\.order\("created_at", \{ ascending: false \}\)[\s\S]*?\.order\("id", \{ ascending: false \}\)/);
  assert.match(page, /catch \{[\s\S]*?<TransactionsError message="Transaksi gagal dimuat/);

  // Dashboard only needs its newest four rows, not the full history.
  assert.match(dashboard, /buildTransactionListQuery\(supabase, user\.id, \{\}\)\.limit\(4\)/);
});

test("editing or deleting a vanished/foreign transaction cannot report success", () => {
  const actions = read("app/(app)/transactions/actions.ts");
  const update = actions.split("export async function updateTransaction(")[1]?.split("export async function deleteTransaction(")[0];
  const remove = actions.split("export async function deleteTransaction(")[1];

  assert.ok(update, "updateTransaction action exists");
  assert.ok(remove, "deleteTransaction action exists");

  assert.match(update, /\.update\(buildTransactionUpdatePayload\(input\)\)[\s\S]*?\.eq\("id", id\)[\s\S]*?\.eq\("user_id", user\.id\)[\s\S]*?\.select\("id"\)[\s\S]*?\.maybeSingle\(\)/);
  assert.match(remove, /\.delete\(\)[\s\S]*?\.eq\("id", id\)[\s\S]*?\.eq\("user_id", user\.id\)[\s\S]*?\.select\("id"\)[\s\S]*?\.maybeSingle\(\)/);

  for (const [name, action] of [["update", update], ["delete", remove]]) {
    assert.match(action, /const \{ data, error \} = await supabase/, name + " must inspect returned row");
    assert.match(action, /if \(!data\) \{[\s\S]*?return \{ ok: false, message:/, name + " must fail closed on zero rows");
    assert.ok(action.indexOf("if (!data)") < action.lastIndexOf("return { ok: true }"),
      name + " must not return success before checking the affected row");
  }
});
