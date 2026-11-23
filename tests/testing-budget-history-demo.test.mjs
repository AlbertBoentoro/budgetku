import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  DEMO_BUDGET_LIMITS,
  DEMO_BUDGET_TRANSACTIONS,
  DEMO_EXPENSE_CATEGORIES,
  DEMO_TRANSACTIONS,
} from "../lib/testing/demo-budgetku-data.ts";
import { getBudgetLimitStatus } from "../lib/budget-limit-status.ts";

const demoMonth = "2026-11";

function demoCategorySpending(name) {
  const category = DEMO_EXPENSE_CATEGORIES.find((item) => item.name === name);
  assert.ok(category, `Missing fixture category: ${name}`);
  const transactions = DEMO_BUDGET_TRANSACTIONS.filter(
    (tx) =>
      tx.transaction_type === "expense" &&
      tx.category_id === category.id &&
      tx.transaction_at.startsWith(demoMonth),
  );
  return {
    count: transactions.length,
    spent: transactions.reduce((sum, tx) => sum + tx.amount, 0),
  };
}

test("public budget demo has seven unique real synthetic categories and eight extra dummy expenses", () => {
  assert.equal(DEMO_BUDGET_LIMITS.length, 7);
  assert.equal(new Set(DEMO_BUDGET_LIMITS.map((item) => item.categoryName)).size, 7);
  for (const item of DEMO_BUDGET_LIMITS) {
    assert.ok(DEMO_EXPENSE_CATEGORIES.some((category) => category.name === item.categoryName));
  }
  assert.equal(DEMO_BUDGET_TRANSACTIONS.length - DEMO_TRANSACTIONS.length, 8);
});

test("Food & Beverage demonstrates exactly four November expenses totalling Rp205000", () => {
  assert.deepEqual(demoCategorySpending("Food & Beverage"), { count: 4, spent: 205000 });
  const limit = DEMO_BUDGET_LIMITS.find((item) => item.categoryName === "Food & Beverage");
  assert.equal(limit?.plannedAmount, 550000);
});

test("budget demo covers normal, near, at-limit, and over-limit statuses", () => {
  const statusOf = (name) => {
    const limit = DEMO_BUDGET_LIMITS.find((item) => item.categoryName === name);
    assert.ok(limit);
    return getBudgetLimitStatus(limit.plannedAmount, demoCategorySpending(name).spent);
  };
  assert.equal(statusOf("Food & Beverage"), "normal");
  assert.equal(statusOf("Transportation"), "near");
  assert.equal(statusOf("Entertainment"), "at_limit");
  assert.equal(statusOf("Donations & Gifts"), "over");
  assert.equal(statusOf("Shopping"), "normal");
});

test("public demo routes are preview-only, read-only, and linked from the testing landing page", () => {
  const home = readFileSync(new URL("../app/testing/page.tsx", import.meta.url), "utf8");
  const budget = readFileSync(new URL("../app/testing/budget/page.tsx", import.meta.url), "utf8");
  const history = readFileSync(new URL("../app/testing/budget/history/[categoryId]/page.tsx", import.meta.url), "utf8");

  assert.match(home, /href="\/testing\/budget"/);
  assert.match(budget, /isPublicTestingDemoAllowed\(\)/);
  assert.match(history, /isPublicTestingDemoAllowed\(\)/);
  assert.match(budget, /href=\{\`\/testing\/budget\/history\/\$\{category\.id\}\`\}/);
  assert.match(history, /transaction\.transaction_type === "expense"/.replace("transaction", "row"));
  assert.match(history, /row\.transaction_at\.startsWith\(DEMO_MONTH\)/);
  for (const source of [budget, history]) {
    assert.doesNotMatch(source, /createClient\(|from\s+["']@\/lib\/supabase\/|deleteBudgetItem\(|updateBudgetItem\(/);
  }
});
