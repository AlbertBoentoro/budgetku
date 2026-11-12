import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EXPENSE_CATEGORY_SECTIONS,
  groupTransactionCategories,
} from "../lib/category-groups.ts";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("expense category groups match the reference without creating missing categories", () => {
  const names = [
    "Food & Beverage", "Transportation", "Household Needs", "Bills & Utilities",
    "Family", "Shopping", "Health & Sports", "Donations & Gifts", "Travel",
    "Entertainment", "Education", "Investment", "Online Loan",
    "Other Financial Expenses", "Other Expense",
  ];
  const source = names.map((name, index) => ({ id: String(index + 1), name }));
  const groups = groupTransactionCategories(source, "expense");
  const byKey = Object.fromEntries(groups.map((group) => [group.key,
    group.items.map(({ category }) => category.name)]));

  assert.deepEqual(EXPENSE_CATEGORY_SECTIONS.map((g) => g.label), [
    "DAILY NEEDS", "HOUSEHOLD NEEDS", "PERSONAL NEEDS",
    "FINANCE", "SERVICES", "OTHERS",
  ]);
  assert.deepEqual(groups.map((group) => group.key),
    ["daily", "household", "personal", "finance", "others"]);
  assert.deepEqual(byKey.daily, ["Food & Beverage", "Transportation"]);
  assert.deepEqual(byKey.household, ["Household Needs", "Bills & Utilities", "Family"]);
  assert.deepEqual(byKey.personal, ["Shopping", "Health & Sports", "Donations & Gifts",
    "Travel", "Entertainment", "Education"]);
  assert.deepEqual(byKey.finance, ["Online Loan", "Investment", "Other Financial Expenses"]);
  assert.deepEqual(byKey.others, ["Other Expense"]);
  assert.equal(groups.flatMap((group) => group.items).length, source.length);
  assert.deepEqual(source.map((cat) => cat.name), names, "must not mutate original rows");
  assert.ok(groups.every((group) => group.items.every((row) => source.includes(row.category))),
    "original records and IDs must be preserved");
});

test("reference names, unknown custom names and income categories remain selectable", () => {
  const expense = [
    { id: "pets", name: "Pets" },
    { id: "business", name: "Business" },
    { id: "services", name: "Other Services" },
    { id: "custom", name: "Laundry Pribadi" },
  ];
  const groups = groupTransactionCategories(expense, "expense");
  assert.deepEqual(groups.map((g) => g.key),
    ["household", "finance", "services", "others"]);
  assert.equal(groups.find((g) => g.key === "household").items[0].category.id, "pets");
  assert.equal(groups.find((g) => g.key === "finance").items[0].category.id, "business");
  assert.equal(groups.find((g) => g.key === "services").items[0].category.id, "services");
  assert.equal(groups.find((g) => g.key === "others").items[0].category.id, "custom");

  const income = [
    { id: "income-1", name: "Salary" },
    { id: "income-2", name: "Bonus" },
    { id: "income-3", name: "Side Hustle" },
  ];
  const [section] = groupTransactionCategories(income, "income");
  assert.equal(section.label, "PEMASUKAN");
  assert.deepEqual(section.items.map((item) => item.category.id), income.map((row) => row.id));
  assert.deepEqual(groupTransactionCategories([], "income"), []);
});

test("transaction category picker renders grouped rows with all existing controls", () => {
  const picker = read("components/transactions/transaction-selection-screens.tsx");
  const form = read("components/finance/transaction-form.tsx");
  assert.match(picker, /groupTransactionCategories\(results, direction\)/);
  assert.match(picker, /grouped\.map\(\(group\) =>/);
  assert.match(picker, /<h3[^>]*>[\s\S]*?\{group\.label\}/);
  assert.match(picker, /\{category\.name\}/);
  assert.match(picker, /onClick=\{\(\) => onPick\(category\.id\)\}/);
  assert.match(picker, /selectedId === category\.id/);
  assert.match(picker, /placeholder="Cari kategori"/);
  assert.match(picker, /Buat kategori baru/);
  assert.match(picker, /Simpan dan pilih kategori/);
  assert.match(form, /<TransactionCategoryScreen/);
  assert.doesNotMatch(picker, /\.insert\(|\.update\(|\.delete\(/);
});
