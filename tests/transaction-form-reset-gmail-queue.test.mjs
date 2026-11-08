import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(
  new URL(`../${path}`, import.meta.url), "utf8",
);

test("a successfully created transaction clears every previous entry, without clearing edits or failed submissions", () => {
  const form = file("components/finance/transaction-form.tsx");
  const a = form.indexOf("function resetAfterSuccessfulCreate()");
  const b = form.indexOf("function handleSubmit", a);
  assert.ok(a > -1 && b > a, "reset must be a create-only helper");
  const reset = form.slice(a, b);
  for (const snippet of [
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
    'recurringRequestId.current = null',
    'setFieldErrors({})',
    'setFormError(null)',
    'setNewCategoryName("")',
    'setShowCategoryCreator(false)',
  ]) {
    assert.ok(reset.includes(snippet), `Reset missing ${snippet}`);
  }
  const success = form.slice(form.indexOf("startTransition(async () => {", b), form.indexOf("const submitLabel", b));
  assert.match(success, /if \(result\.ok\)\s*\{\s*if \(mode === "create"\) resetAfterSuccessfulCreate\(\);/);
  assert.ok(success.indexOf("resetAfterSuccessfulCreate()") < success.indexOf("router.push("));
  assert.match(success, /setFormError\(result\.message\)/);
  assert.ok(!success.slice(success.indexOf("if (result.fieldErrors)")).includes("resetAfterSuccessfulCreate()"));
});

test("pending Gmail cards are shown above calendar day sections, without creating ledger rows", () => {
  const page = file("app/(app)/transactions/page.tsx");
  const queue = file("components/transactions/gmail-pending-queue.tsx");
  assert.match(page, /\.from\("email_imports"\)/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.eq\("status", "pending"\)/);
  assert.match(page, /\.limit\(3\)/);
  assert.match(page, /readGmailPreview\(draft\.parsed_preview\)/);
  assert.match(page, /!hasOtherFilter &&/);
  assert.ok(page.indexOf("{gmailQueue}", page.indexOf("<LedgerSummaryPill")) <
    page.indexOf("<TransactionDayGroups"));
  assert.match(page, /\{gmailQueue\}\s*<LedgerEmptyState/);
  assert.match(queue, /Menunggu persetujuan Gmail/);
  assert.match(queue, /belum masuk saldo/);
  assert.match(queue, /router\.refresh\(\)/);
  assert.match(queue, /ignoreImport\(id\)/);
  assert.match(queue, /\?review=\$\{encodeURIComponent\(draft\.id\)\}/);
  assert.match(queue, /Terima/);
  assert.match(queue, /Tolak/);
  assert.match(queue, /Lihat semua/);
  assert.doesNotMatch(queue, /\.from\("transactions"\)|importDraft\(/);
});

test("Gmail accept remains scoped, confirm-before-write, and rejected drafts cannot be re-accepted", () => {
  const actions = file("app/(app)/settings/gmail/actions.ts");
  const accept = actions.slice(actions.indexOf("export async function importDraft"), actions.indexOf("export async function ignoreImport"));
  assert.match(accept, /\.eq\("user_id", user\.id\)/);
  assert.match(accept, /importRow\.status !== "pending"/);
  // The shared validation helper runs before the accept handler's database write.
  assert.match(actions, /isValidTransactionIdrAmount\(input\.amount\)/);
  assert.match(accept, /const fieldErrors = validateDraft\(input\)/);
  assert.match(accept, /ownsActiveAccount/);
  assert.match(accept, /canUseCategory/);
  assert.match(accept, /source: "email"/);
  assert.match(accept, /source_reference: importRow\.gmail_message_id/);
  const review = file("components/finance/gmail-import-review.tsx");
  assert.match(review, /Pilih rekening/);
  assert.match(review, /categoryId/);
  assert.match(review, /transactionAmountInputFromValue\(candidate\.amount\)/);
  assert.match(review, /inputMode="decimal"/);
  assert.match(review, /formatTransactionAmountInput\(raw, amountInput\)/);
  const reject = actions.slice(actions.indexOf("export async function ignoreImport"));
  assert.match(reject, /status: "skipped"/);
  assert.match(reject, /revalidatePath\("\/transactions"\)/);
});

test("queue keeps error and low confidence feedback accessible on mobile", () => {
  const queue = file("components/transactions/gmail-pending-queue.tsx");
  assert.match(queue, /role="alert"/);
  assert.match(queue, /aria-labelledby="gmail-pending-title"/);
  assert.match(queue, /disabled=\{isPending \|\| busyId !== null\}/);
  assert.match(queue, /preview\?\.confidence === "low"/);
  assert.match(queue, /min-h-11/);
  assert.match(queue, /flex-wrap/);
  assert.match(queue, /Lihat semua/);
  assert.match(queue, /Periksa transaksi yang sudah dicatat manual/);
});
