import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { shiftTransactionDate } from "../lib/transaction-date-navigation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("date arrows use calendar arithmetic through leap years, DST and year change", () => {
  assert.equal(shiftTransactionDate("2026-11-11", -1), "2026-11-10");
  assert.equal(shiftTransactionDate("2026-11-11", 1), "2026-11-12");
  assert.equal(shiftTransactionDate("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftTransactionDate("2024-02-29", 1), "2024-03-01");
  assert.equal(shiftTransactionDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftTransactionDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftTransactionDate("2026-02-31", 1), "2026-02-31");
  assert.equal(shiftTransactionDate("bad-date", -1), "bad-date");
});

test("Finku-inspired create view keeps three type tabs, hero amount and interactive date", () => {
  const form = read("components/finance/transaction-form.tsx");
  const switcher = read("components/transactions/transaction-type-switcher.tsx");
  assert.match(switcher, /value: "expense"/);
  assert.match(switcher, /value: "income"/);
  assert.match(switcher, /value: "transfer"/);
  assert.match(switcher, /border-b-\[3px\]/);
  assert.match(form, /setTransactionAt\(\(date\) => shiftTransactionDate\(date, -1\)\)/);
  assert.match(form, /setTransactionAt\(\(date\) => shiftTransactionDate\(date, 1\)\)/);
  assert.match(form, /id=\{dateId\}/);
  assert.match(form, /type="date"/);
  assert.match(form, /inputMode="decimal"/);
  assert.match(form, /parseTransactionAmountInput\(amountInput\)/);
  assert.match(form, /isValidTransactionIdrAmount\(amount\)/);
  assert.match(form, /max-w-\[calc\(100%-3\.5rem\)\]/);
  assert.match(form, /PRESETS\.map/);
});

test("desktop amount remains prominent despite the shared Input md:text-sm default", () => {
  const form = read("components/finance/transaction-form.tsx");
  const sharedInput = read("components/ui/input.tsx");
  const amountInput = form.match(/<Input\s+id=\{amountId\}[\s\S]*?\/>/)?.[0];
  assert.ok(amountInput, "The editable amount input must exist");
  assert.match(sharedInput, /md:text-sm/, "This regression depends on the shared input breakpoint");
  assert.match(amountInput, /text-\[clamp\(2\.5rem,13vw,4\.25rem\)\]/, "Keep the current mobile amount size");
  assert.match(amountInput, /md:text-5xl lg:text-6xl/, "Desktop must explicitly override the shared small input size");
  assert.match(form, /shrink-0 text-title-lg md:text-2xl lg:text-3xl/, "Rupiah prefix should scale with the desktop amount");
  assert.match(amountInput, /max-w-\[calc\(100%-3\.5rem\)\]/, "Large amounts must remain container-bounded");
});

test("account chips allow selecting distinct accounts while transfer keeps owned destination logic", () => {
  const form = read("components/finance/transaction-form.tsx");
  assert.match(form, /aria-pressed=\{selected\}/);
  assert.match(form, /onClick=\{\(\) => handleAccountChange\(account\.id\)\}/);
  assert.match(form, /overflow-x-auto/);
  assert.match(form, /setDestinationAccountId\(""/);
  assert.match(form, /destinationOptions\.map/);
  assert.match(form, /destinationAccountId === accountId/);
  assert.match(form, /transactionType === "transfer"/);
});

test("category selection displays its own full screen with search and can create real user categories", () => {
  const form = read("components/finance/transaction-form.tsx");
  const screen = read("components/transactions/transaction-selection-screens.tsx");
  const action = read("app/(app)/transactions/category-actions.ts");
  assert.match(form, /openSelectionScreen\("category"\)/);
  assert.match(form, /<TransactionCategoryScreen/);
  assert.match(form, /onPick=\{\(id\) => \{/);
  assert.match(form, /setCategoryId\(id\)/);
  assert.match(screen, /role="dialog"/);
  assert.match(screen, /aria-modal="true"/);
  assert.match(screen, /title="Pilih kategori"/);
  assert.match(screen, /placeholder="Cari kategori"/);
  assert.match(screen, /Buat kategori baru/);
  assert.match(screen, /Simpan dan pilih kategori/);
  assert.match(form, /createUserCategory\(\{ name, category_type: direction \}\)/);
  assert.match(action, /\.eq\("is_archived", false\)/);
  assert.match(form, /aria-hidden=\{activeScreen !== null\}/);
  assert.match(form, /inert=\{activeScreen !== null\}/);
});

test("duplicate picker offers ten newest first and all 100, without automatically writing a transaction", () => {
  const page = read("app/(app)/transactions/new/page.tsx");
  const form = read("components/finance/transaction-form.tsx");
  const screen = read("components/transactions/transaction-selection-screens.tsx");
  assert.match(page, /\.from\("transactions"\)/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.limit\(100\)/);
  assert.match(page, /recentTransactions=\{recent\.error \? \[\] : recent\.data \?\? \[\]\}/);
  assert.match(screen, /filtered\.slice\(0, 10\)/);
  assert.match(screen, /Lihat semua \{transactions\.length\} transaksi terbaru/);
  assert.match(screen, /onClick=\{\(\) => onPick\(txn\)\}/);
  assert.match(form, /function handleDuplicatePick/);
  assert.match(form, /setTransactionAt\(todayValue\(\)\)/);
  assert.match(form, /setRecurring\(false\)/);
  assert.match(form, /recurringRequestId\.current = null/);
  assert.match(form, /const sourceExists = accounts\.some/);
  assert.match(form, /const categoryExists = eligibleCategories\.some/);
  assert.doesNotMatch(screen, /createTransaction\(|\.from\("transactions"\)\.insert\(/);
  const duplicateSelect = page.match(/\.select\("([^"]+)"\)/)?.[1] ?? "";
  assert.ok(duplicateSelect.includes("account_id"), "Duplicate fetch must include form fields");
  assert.ok(!duplicateSelect.split(",").includes("source_reference"),
    "Never fetch email import idempotency references for duplication");
});

test("existing Gmail review and edit reuse the form without a duplicate action", () => {
  const form = read("components/finance/transaction-form.tsx");
  const gmail = read("components/finance/gmail-import-review.tsx");
  assert.match(form, /isCreate && allowRecurring/);
  assert.match(gmail, /allowRecurring=\{false\}/);
  assert.match(gmail, /initialValues=\{initialValues\}/);
  assert.match(form, /initialValues\?\.description/);
  assert.match(form, /initialValues\?\.merchant/);
  assert.match(form, /if \(mode === "create"\) resetAfterSuccessfulCreate\(\);/);
  assert.match(form, /if \(result\.ok\)/);
});

test("no new network writes are required to open pickers", () => {
  const screens = read("components/transactions/transaction-selection-screens.tsx");
  assert.doesNotMatch(screens, /createClient\(|fetch\(|\.insert\(|\.update\(/);
  assert.match(screens, /onBack=\{onBack\}|onBack/);
});
