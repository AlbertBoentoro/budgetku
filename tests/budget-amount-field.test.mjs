import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  openingBalanceInputFromValue,
  parseOpeningBalanceInput,
  applyOpeningBalanceEdit,
} from "../lib/opening-balance-input.ts";

test("existing monthly budget is shown in Rp inside its own field", () => {
  assert.equal(openingBalanceInputFromValue(550000), "Rp 550.000");
  assert.equal(openingBalanceInputFromValue(150000.41), "Rp 150.000,41");
  assert.equal(parseOpeningBalanceInput("Rp 550.000"), 550000);
  assert.equal(parseOpeningBalanceInput("Rp 150.000,41"), 150000.41);
});

test("typing into a budget field uses the shared caret-aware formatter", () => {
  const edit = applyOpeningBalanceEdit("Rp 1.000", "Rp 10.000", 5, "insertText");
  assert.equal(edit.value, "Rp 10.000");
  assert.ok(edit.caret > 0);
});

test("budget form has no raw value or secondary currency preview", () => {
  const form = readFileSync(new URL("../components/finance/budget-item-form.tsx", import.meta.url), "utf8");
  assert.match(form, /openingBalanceInputFromValue\(initialValues\.planned_amount\)/);
  assert.match(form, /applyOpeningBalanceEdit\(/);
  assert.match(form, /const amount = parseOpeningBalanceInput\(amountInput\)/);
  assert.match(form, /onChange=\{handleAmountChange\}/);
  assert.match(form, /inputMode="decimal"/);
  assert.doesNotMatch(form, /amountPreview|idrPreview|parseIdrInput/);
});

test("obsolete fixed expense marker is hidden without resetting existing data", () => {
  const form = readFileSync(new URL("../components/finance/budget-item-form.tsx", import.meta.url), "utf8");
  const row = readFileSync(new URL("../components/finance/budget-item-row.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(form, /<Checkbox|Pengeluaran tetap|fixedFieldId|setIsFixed/);
  assert.doesNotMatch(row, /item\.is_fixed|>Tetap</);
  assert.match(form, /is_fixed: mode === "edit" \? initialValues\?\.is_fixed \?\? false : false/);
});
