import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { getBudgetLimitStatus } from "../lib/budget-limit-status.ts";

test("budget status preserves the actual amount boundaries", () => {
  assert.equal(getBudgetLimitStatus(600000, 0), "normal");
  assert.equal(getBudgetLimitStatus(600000, 539999), "normal");
  assert.equal(getBudgetLimitStatus(600000, 540000), "near");
  assert.equal(getBudgetLimitStatus(600000, 599999), "near");
  assert.equal(getBudgetLimitStatus(600000, 600000), "at_limit");
  assert.equal(getBudgetLimitStatus(330000, 330000), "at_limit");
  assert.equal(getBudgetLimitStatus(300000, 300000), "at_limit");
  assert.equal(getBudgetLimitStatus(600000, 600001), "over");
});

test("zero budget is not mislabeled as reached", () => {
  assert.equal(getBudgetLimitStatus(0, 0), "normal");
  assert.equal(getBudgetLimitStatus(0, 1), "over");
});

test("the visual label exposes distinct near, limit, and excess statuses", () => {
  const ui = readFileSync(
    new URL("../components/finance/budget-item-row.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /budgetStatus === "at_limit"/);
  assert.match(ui, /Di batas/);
  assert.match(ui, /budgetStatus === "near"/);
  assert.match(ui, /Mendekati batas/);
  assert.match(ui, /budgetStatus === "over"/);
  assert.match(ui, /Melebihi batas/);
  assert.doesNotMatch(ui, /const isNear = !usage.isOverBudget/);
});
