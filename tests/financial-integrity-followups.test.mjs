import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  MAX_TRANSACTION_AMOUNT,
  isValidTransactionAmount,
} from "../lib/transactions/amount-limits.ts";

test("F-04: only positive exact whole IDR up to selective restore limit", () => {
  assert.equal(MAX_TRANSACTION_AMOUNT, 1_000_000_000_000);
  for (const value of [1, 3500, 1_000_000_000_000]) {
    assert.equal(isValidTransactionAmount(value), true, String(value));
  }
  for (const value of [
    null, undefined, "", "1000", 0, -1, 12.5, Number.NaN,
    Infinity, 1_000_000_000_001, Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(isValidTransactionAmount(value), false, String(value));
  }
});

test("F-04: manual, recurring, and Gmail flows share the exact amount validator", () => {
  const paths = [
    "app/(app)/transactions/actions.ts",
    "app/(app)/recurring/actions.ts",
    "components/finance/transaction-form.tsx",
    "components/finance/recurring-form.tsx",
    "app/(app)/settings/gmail/actions.ts",
    "components/finance/gmail-import-review.tsx",
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /isValidTransactionAmount\(/, path);
  }
});

test("F-06: ledger reads every uniquely sorted page", () => {
  const list = readFileSync(new URL("../app/(app)/transactions/page.tsx", import.meta.url), "utf8");
  const query = readFileSync(new URL("../lib/transactions.ts", import.meta.url), "utf8");
  assert.match(list, /fetchAllPages\(\(from, to\) =>[\s\S]*?buildTransactionListQuery\([\s\S]*?\.range\(from, to\)/);
  assert.match(query, /\.order\("id", \{ ascending: false \}\)/);
});

test("F-07: updates and deletes distinguish missing rows from success", () => {
  const source = readFileSync(new URL("../app/(app)/transactions/actions.ts", import.meta.url), "utf8");
  assert.match(source, /data: updated[\s\S]*?\.maybeSingle\(\)/);
  assert.match(source, /if \(!updated\)/);
  assert.match(source, /data: deleted[\s\S]*?\.maybeSingle\(\)/);
  assert.match(source, /if \(!deleted\)/);
});

test("F-11: manual backup preflight measures compact uploaded bytes", () => {
  const source = readFileSync(new URL("../app/api/settings/backup/route.ts", import.meta.url), "utf8");
  assert.match(source, /JSON\.stringify\(backup\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(backup, null, 2\)/);
});
