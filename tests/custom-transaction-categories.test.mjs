import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isUserCategoryType, normalizeCategoryName } from "../lib/category-name.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("normalized categories compare names by case and spacing", () => {
  assert.equal(normalizeCategoryName(" Laundry "), "laundry");
  assert.equal(normalizeCategoryName("LAUNDRY"), "laundry");
  assert.equal(normalizeCategoryName("Uang   Makan"), "uang makan");
  assert.notEqual(normalizeCategoryName("Laundry"), normalizeCategoryName("Transport"));
});

test("only income and expense categories can be created", () => {
  for (const t of ["income", "expense"]) assert.equal(isUserCategoryType(t), true);
  for (const t of ["transfer", "", "other", "Income"]) assert.equal(isUserCategoryType(t), false);
});

test("category action uses logged-in user, validates, checks duplicate then inserts", () => {
  const src=read("app/(app)/transactions/category-actions.ts");
  assert.match(src,/supabase\.auth\.getUser\(\)/);
  assert.match(src,/user_id: user\.id/);
  assert.match(src,/is_system: false/);
  assert.match(src,/isUserCategoryType\(input\.category_type\)/);
  assert.match(src,/normalizeCategoryName\(row\.name\) === normalizeCategoryName\(name\)/);
  assert.match(src,/fetchAllPages/);
  assert.match(src,/is_archived", false/);
});

test("transaction form creates, selects, and preserves user categories", () => {
  const form=read("components/finance/transaction-form.tsx");
  assert.match(form,/createUserCategory\(\{ name, category_type: direction \}\)/);
  assert.match(form,/setCategoryId\(result\.category\.id\)/);
  assert.match(form,/createdCategories\.filter/);
  const picker=read("components/transactions/transaction-selection-screens.tsx");
  assert.match(form,/openSelectionScreen\("category"\)/);
  assert.match(form,/onCreate=\{handleCreateCategory\}/);
  assert.match(picker,/Buat kategori baru/);
  assert.match(picker,/Simpan dan pilih kategori/);
  assert.match(form,/type="button"/);
  assert.match(form,/setShowCategoryCreator\(false\)/);
});

test("unique index scopes to user, type and nonarchived categories", () => {
  const sql=read("docs/sql/2026-11-user-category-uniqueness.sql");
  assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS categories_user_active_type_name_uidx/);
  assert.match(sql,/category_type,/);
  assert.match(sql,/WHERE user_id IS NOT NULL AND is_archived = false/);
  assert.doesNotMatch(sql,/DELETE FROM public\.categories|UPDATE public\.categories/i);
});

test("switching transaction direction clears a category selected for another direction", () => {
  const source = read("components/finance/transaction-form.tsx");
  assert.ok(source.includes('if (nextType !== transactionType) setCategoryId("");'));
  assert.ok(source.includes("!baseCategoryOptions.some"));
});
