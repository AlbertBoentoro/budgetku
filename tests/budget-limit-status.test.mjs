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

test("decimal spending compares sen accurately, not floating-point approximations", () => {
  assert.equal(getBudgetLimitStatus(0.41, 0), "normal");
  assert.equal(getBudgetLimitStatus(0.41, 0.37), "near");
  assert.equal(getBudgetLimitStatus(0.41, 0.41), "at_limit");
  assert.equal(getBudgetLimitStatus(0.3, 0.1 + 0.2), "at_limit");
  assert.equal(getBudgetLimitStatus(1_000, 1_000.01), "over");
  assert.equal(getBudgetLimitStatus(600_000, 599_999.99), "near");
  assert.equal(getBudgetLimitStatus(600_000, 600_000.01), "over");
});

test("all four budget statuses have distinct label and progress-bar colors", () => {
  const ui = readFileSync(
    new URL("../components/finance/budget-item-row.tsx", import.meta.url),
    "utf8",
  );
  // Label colors (light / dark text contrast) must be distinct.
  assert.match(ui, /text-income[\s\S]*Normal/);
  assert.match(ui, /text-amber-700 dark:text-amber-400[\s\S]*Mendekati batas/);
  assert.match(ui, /text-orange-700 dark:text-orange-400[\s\S]*Di batas/);
  assert.match(ui, /text-expense[\s\S]*Melebihi batas/);
  // Bar colors must not use the previous all-primary fallback.
  for (const color of ["bg-income", "bg-amber-500", "bg-orange-500", "bg-expense"]) {
    assert.ok(ui.includes(color), `Missing bar color ${color}`);
  }
  assert.match(ui, /className=\{\`h-full rounded-full \$\{barColor\}\`\}/);
  const symbols = readFileSync(
    new URL("../components/ui/material-symbols.ts", import.meta.url), "utf8",
  );
  assert.match(symbols, /"check_circle"/);
});
