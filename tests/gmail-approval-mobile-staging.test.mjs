import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Gmail approval uses the exact same mobile Catat form, with all three types", () => {
  const review=read("components/finance/gmail-import-review.tsx");
  const form=read("components/finance/transaction-form.tsx");
  const switcher=read("components/transactions/transaction-type-switcher.tsx");
  assert.match(review, /<TransactionForm/);
  assert.match(review, /mode="create"/);
  assert.match(review, /initialValues=\{initialValues\}/);
  assert.match(review, /submitText="Terima dan catat transaksi"/);
  assert.match(review, /allowRecurring=\{false\}/);
  assert.match(review, /onCancel=\{/);
  assert.match(form, /<TransactionTypeSwitcher/);
  assert.match(switcher, /value: "expense"/);
  assert.match(switcher, /value: "income"/);
  assert.match(switcher, /value: "transfer"/);
  assert.match(form, /label="Rekening tujuan"/);
  assert.match(form, /<TransactionCategoryScreen/);
  assert.match(read("components/transactions/transaction-selection-screens.tsx"), /Buat kategori baru/);
  assert.match(form, /inputMode="decimal"/);
  assert.match(form, /canCreateRecurring && recurring/);
  assert.match(form, /if \(onSuccess\)/);
});

test("Gmail transfer is user-selected, owned, distinct-account and category-free", () => {
  const review=read("components/finance/gmail-import-review.tsx");
  const action=read("app/(app)/settings/gmail/actions.ts");
  assert.match(review, /candidate\.direction \?\? "expense"/);
  assert.match(review, /account_id: ""/);
  assert.match(review, /destination_account_id: null/);
  assert.match(review, /input\.transaction_type === "transfer"/);
  assert.match(action, /transaction_type: "income" \| "expense" \| "transfer"/);
  assert.match(action, /input\.destination_account_id === input\.account_id/);
  assert.match(action, /ownsActiveAccount\(\s*supabase, user\.id, input\.destination_account_id/);
  assert.match(action, /destination_account_id: isTransfer \? input\.destination_account_id : null/);
  assert.match(action, /category_id: isTransfer \? null : input\.category_id/);
  assert.match(action, /source_reference: importRow\.gmail_message_id/);
  assert.match(action, /importRow\.status !== "pending"/);
  assert.match(action, /isValidTransactionIdrAmount\(input\.amount\)/);
});

test("Gmail review is full-screen and no longer embedded in a tiny card", () => {
  const page=read("app/(app)/transactions/gmail/[id]/page.tsx");
  assert.match(page, /title="Terima dari Gmail"/);
  assert.match(page, /<AppBackLink/);
  assert.match(page, /<PageContainer className="pb-8">/);
  assert.match(page, /<GmailImportReview/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.eq\("status", "pending"\)/);
  assert.match(page, /readGmailPreview\(draft\.parsed_preview\)/);
  const row=read("components/finance/gmail-draft-row.tsx");
  assert.match(row, /\/transactions\/gmail\/\$\{encodeURIComponent\(draft\.id\)\}/);
  const queue=read("components/transactions/gmail-pending-queue.tsx");
  assert.match(queue, /\/transactions\/gmail\/\$\{encodeURIComponent\(draft\.id\)\}/);
  assert.match(queue, /ignoreImport\(id\)/);
  assert.match(queue, /belum masuk saldo/);
});

test("pending Gmail stays outside the real transaction ledger and has its own inbox", () => {
  const page=read("app/(app)/transactions/page.tsx");
  const inbox=read("app/(app)/transactions/gmail/page.tsx");
  assert.match(page, /\.from\("email_imports"\)/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.eq\("status", "pending"\)/);
  assert.match(page, /\.limit\(100\)/);
  assert.match(page, /\{gmailQueue\}/);
  assert.match(inbox, /\.eq\("status", "pending"\)/);
  assert.match(inbox, /\.eq\("user_id", user\.id\)/);
  assert.match(inbox, /\.limit\(100\)/);
  assert.match(inbox, /showAllLink=\{false\}/);
  assert.doesNotMatch(inbox, /\.insert\(/);
});

test("preview-to-staging rule is explicit; production remains untouched", () => {
  const migration=read("docs/sql/staging-gmail-review-compat-20261109.sql");
  assert.match(migration, /STAGING ONLY/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.email_imports FROM anon/);
  assert.match(migration, /auth\.uid\(\)=user_id/);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY/);
});
