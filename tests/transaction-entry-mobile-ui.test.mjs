import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Catat routes to the distinct mobile composer without affecting Edit or Gmail", () => {
  const page = read("app/(app)/transactions/new/page.tsx");
  const edit = read("app/(app)/transactions/[id]/edit/page.tsx");
  const gmail = read("components/finance/gmail-import-review.tsx");
  assert.match(page, /<NewTransactionComposer/);
  assert.match(page, /restore=\{restore\}/);
  assert.match(edit, /<TransactionForm/);
  assert.match(gmail, /<TransactionForm/);
  assert.doesNotMatch(page, /importDraft\(/);
});

test("manual composer includes date navigation, amount, account chips, category page and safe submit", () => {
  const ui = read("components/finance/new-transaction-composer.tsx");
  const type = read("components/transactions/transaction-type-switcher.tsx");
  assert.match(ui, /<TransactionTypeSwitcher/);
  for (const t of ['value: "expense"', 'value: "income"', 'value: "transfer"']) {
    assert.ok(type.includes(t), `Missing type ${t}`);
  }
  assert.match(ui, /shiftEntryDate\(draft\.transactionAt, -1\)/);
  assert.match(ui, /shiftEntryDate\(draft\.transactionAt, 1\)/);
  assert.match(ui, /inputMode="decimal"/);
  assert.match(ui, /parseTransactionAmountInput\(draft\.amountInput\)/);
  assert.match(ui, /isValidTransactionIdrAmount\(amount\)/);
  assert.match(ui, /overflow-x-auto/);
  assert.match(ui, /accounts\.map\(account/);
  assert.match(ui, /\/transactions\/new\/categories\?type=/);
  assert.match(ui, /\/transactions\/new\/duplicate/);
  assert.match(ui, /id="new-entry-target"/);
  assert.match(ui, /createTransaction\(\{/);
  assert.match(ui, /destination_account_id: isTransfer \? draft\.destinationAccountId : null/);
  assert.match(ui, /category_id: isTransfer \? null : draft\.categoryId/);
  assert.doesNotMatch(ui, /\.from\("transactions"\)\.insert\(/);
});

test("Add More saves once and resets; Done saves once then navigates; failed submit retains form", () => {
  const ui = read("components/finance/new-transaction-composer.tsx");
  assert.match(ui, /intent = useRef<"again" \| "done">\("done"\)/);
  assert.match(ui, /intent\.current = "again"/);
  assert.match(ui, /intent\.current = "done"/);
  assert.match(ui, /const result = await createTransaction\(/);
  assert.match(ui, /if \(!result\.ok\) \{\s*setError\(result\.message\)/);
  assert.match(ui, /const submissionIntent = intent\.current/);
  assert.match(ui, /setDraft\(defaultEntryDraft\(accounts\[0\]\?\.id \?\? ""\)\)/);
  assert.match(ui, /if \(submissionIntent === "again"\)/);
  assert.match(ui, /router\.push\(savedMonth === currentMonth/);
  assert.match(ui, /recurringRequestId\.current = null/);
  assert.match(ui, /clearEntryDraft\(\)/);
});

test("category picker is a separate authenticated route with search/create and restores all typed fields", () => {
  const page = read("app/(app)/transactions/new/categories/page.tsx");
  const picker = read("components/finance/transaction-category-picker.tsx");
  const composer = read("components/finance/new-transaction-composer.tsx");
  assert.match(page, /title="Pilih kategori"/);
  assert.match(page, /<AppBackLink href="\/transactions\/new\?restore=back"/);
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /fetchUsableCategories\(supabase, user\.id, type\)/);
  assert.match(picker, /type="search"/);
  assert.match(picker, /Cari kategori/);
  assert.match(picker, /Kategori saya/);
  assert.match(picker, /Kategori tersedia/);
  assert.match(picker, /createUserCategory\(\{ name, category_type: direction \}\)/);
  assert.match(picker, /saveEntryDraft\(\{ \.\.\.snapshot, categoryId: category\.id, categoryName: category\.name \}\)/);
  assert.match(picker, /router\.push\("\/transactions\/new\?restore=category"\)/);
  assert.match(composer, /saveEntryDraft\(draft\)/);
  assert.match(composer, /readEntryDraft\(\)/);
  assert.match(composer, /if \(!restore \|\| restored\.current\) return/);
});

test("duplicate list is user-owned, shows last ten, supports view-all and does not post on selection", () => {
  const page = read("app/(app)/transactions/new/duplicate/page.tsx");
  const picker = read("components/finance/transaction-duplicate-picker.tsx");
  const draft = read("lib/transaction-entry-draft.ts");
  assert.match(page, /title="Duplikat transaksi"/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.limit\(100\)/);
  assert.doesNotMatch(page, /source_reference|\.insert\(/);
  assert.match(picker, /matching\.slice\(0, 10\)/);
  assert.match(picker, /Lihat semua transaksi/);
  assert.match(picker, /draftFromTransaction\(/);
  assert.match(picker, /saveEntryDraft\(safe\)/);
  assert.match(picker, /\/transactions\/new\?restore=duplicate/);
  assert.match(draft, /recurring: false/);
  assert.doesNotMatch(picker, /createTransaction\(/);
  assert.match(read("components/ui/material-symbols.ts"), /"content_copy"/);
});
