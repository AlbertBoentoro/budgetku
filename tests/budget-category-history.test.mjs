import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { budgetCategoryHistoryHref } from "../lib/budget-history-link.ts";

test("budget category history keeps category, expense type, and selected month", () => {
  const categoryId = "22222222-2222-4222-8222-222222222222";
  const href = budgetCategoryHistoryHref(categoryId, "2026-11");
  const url = new URL(href, "https://budgetku.example");
  assert.equal(url.pathname, "/transactions");
  assert.equal(url.searchParams.get("type"), "expense");
  assert.equal(url.searchParams.get("category"), categoryId);
  assert.equal(url.searchParams.get("month"), "2026-11");
});

test("history link safely encodes category parameters", () => {
  const url = new URL(budgetCategoryHistoryHref("a&b", "2026-12"), "https://budgetku.example");
  assert.equal(url.searchParams.get("category"), "a&b");
  assert.equal(url.searchParams.get("month"), "2026-12");
});

test("budget row opens transaction history while preserving the edit action", () => {
  const source = readFileSync(
    new URL("../components/finance/budget-item-row.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /budgetCategoryHistoryHref\(item\.category_id, monthParam\)/);
  assert.match(source, /href=\{historyHref\}/);
  assert.match(source, /Lihat riwayat transaksi/);
  assert.doesNotMatch(source, />\s*Riwayat transaksi\s*</); // no duplicate history menu item
  assert.match(source, /\/budget\/items\/\$\{item\.id\}\/edit\?month=\$\{monthParam\}/);
  assert.match(source, /deleteBudgetItem\(item\.id\)/);
});
