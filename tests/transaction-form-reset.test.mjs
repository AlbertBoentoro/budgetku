import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const form = readFileSync(
  new URL("../components/finance/transaction-form.tsx", import.meta.url),
  "utf8",
);

const resetStart = form.indexOf("function resetAfterSuccessfulCreate()");
const submitStart = form.indexOf("function handleSubmit", resetStart);
const submitEnd = form.indexOf("const submitLabel", submitStart);

test("successful Catat clears all previous fields to safe defaults", () => {
  assert.ok(resetStart >= 0 && submitStart > resetStart);
  const reset = form.slice(resetStart, submitStart);
  const expected = [
    'setTransactionType("expense")',
    'setAmountInput("0")',
    'setAccountId(accounts[0]?.id ?? "")',
    'setCategoryId("")',
    'setDestinationAccountId("")',
    'setTransactionAt(todayValue())',
    'setDescription("")',
    'setMerchant("")',
    'setRecurring(false)',
    'setFrequency("monthly")',
    'setIndefinite(true)',
    'setEndDate("")',
    "recurringRequestId.current = null",
    'setShowCategoryCreator(false)',
    'setNewCategoryName("")',
    'setCategoryCreateError(null)',
    "setFieldErrors({})",
    "setFormError(null)",
  ];
  for (const item of expected) {
    assert.ok(reset.includes(item), `After-success reset missing ${item}`);
  }
});

test("only successful create can clear fields, not failed create or edit", () => {
  assert.ok(submitStart > 0 && submitEnd > submitStart);
  const submit = form.slice(submitStart, submitEnd);
  assert.match(
    submit,
    /if \(result\.ok\)\s*\{\s*if \(mode === "create"\) resetAfterSuccessfulCreate\(\);/,
  );
  const successReset = submit.indexOf("resetAfterSuccessfulCreate()");
  const navigation = submit.indexOf("router.push(");
  assert.ok(successReset >= 0 && navigation > successReset);
  const failures = submit.slice(submit.indexOf("if (result.fieldErrors)"));
  assert.doesNotMatch(failures, /resetAfterSuccessfulCreate/);
  assert.match(failures, /setFieldErrors\(result\.fieldErrors as FieldErrors\)/);
  assert.match(failures, /setFormError\(result\.message\)/);
});

test("edit mode continues to initialize from existing transaction values", () => {
  assert.match(form, /initialValues\.amount/);
  assert.match(form, /initialValues\?\.account_id/);
  assert.match(form, /initialValues\?\.category_id/);
  assert.match(form, /initialValues\?\.description/);
  assert.match(form, /initialValues\?\.merchant/);
  assert.match(form, /toDateInputValue\(initialValues\?\.transaction_at\)/);
  assert.match(form, /initialValues\?\.destination_account_id/);
  assert.match(form, /initialValues && isTransactionType\(initialValues\.transaction_type\)/);
});

test("reset retains newly-created categories in options without selecting one", () => {
  const reset = form.slice(resetStart, submitStart);
  // Creating a category persists to Supabase: don't erase the local option,
  // otherwise router cache could temporarily hide the new category.
  assert.doesNotMatch(reset, /setCreatedCategories\(\[\]\)/);
  assert.match(reset, /setCategoryId\(""/);
});
