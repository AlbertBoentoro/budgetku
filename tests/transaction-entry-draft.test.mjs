import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultEntryDraft,
  todayEntryDate,
  shiftEntryDate,
  draftFromTransaction,
  isEntryDraft,
} from "../lib/transaction-entry-draft.ts";

const ACC_A = "account-a";
const ACC_B = "account-b";
const CAT_A = "category-a";
const now = new Date(2026, 10, 11, 9, 0);

const base = {
  id: "tx-id-must-not-copy",
  transaction_type: "expense",
  amount: 13200,
  account_id: ACC_A,
  destination_account_id: null,
  category_id: CAT_A,
  merchant: "Grab",
  description: "Transportasi",
  transaction_at: "2024-01-01",
  source: "email",
  source_reference: "sensitive-email-id-not-to-copy",
};

test("date navigation is calendar-accurate and a duplicate uses today rather than original date", () => {
  assert.equal(todayEntryDate(now), "2026-11-11");
  assert.equal(shiftEntryDate("2026-11-11", 1), "2026-11-12");
  assert.equal(shiftEntryDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftEntryDate("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftEntryDate("invalid", 1), "invalid");
  const copy = draftFromTransaction(base, [ACC_A, ACC_B], [CAT_A], now);
  assert.equal(copy.transactionAt, "2026-11-11");
});

test("expense duplicate copies form fields but never transaction ID/source/reference or recurring schedule", () => {
  const copy = draftFromTransaction(base, [ACC_A, ACC_B], [CAT_A], now);
  assert.deepEqual(
    {
      transactionType: copy.transactionType,
      amountInput: copy.amountInput,
      accountId: copy.accountId,
      categoryId: copy.categoryId,
      merchant: copy.merchant,
      description: copy.description,
    },
    {
      transactionType: "expense", amountInput: "13.200",
      accountId: ACC_A, categoryId: CAT_A,
      merchant: "Grab", description: "Transportasi",
    },
  );
  assert.equal(copy.recurring, false);
  assert.equal(copy.destinationAccountId, "");
  for (const sensitiveField of ["id", "source", "source_reference", "transaction_id"]) {
    assert.equal(Object.hasOwn(copy, sensitiveField), false);
  }
  assert.equal(copy.categoryName, "");
});

test("duplicates preserve exactly two decimal sen and do not invent invalid amounts", () => {
  const copy = draftFromTransaction({ ...base, amount: 0.41 }, [ACC_A], [CAT_A], now);
  assert.equal(copy.amountInput, "0,41");
  assert.equal(draftFromTransaction({ ...base, amount: 0 }, [ACC_A], [CAT_A], now).amountInput, "0");
  assert.equal(draftFromTransaction({ ...base, amount: 0.415 }, [ACC_A], [CAT_A], now).amountInput, "0");
});

test("archived/foreign accounts and categories never silently preselect", () => {
  const copy = draftFromTransaction(base, [ACC_B], [], now);
  assert.equal(copy.accountId, "");
  assert.equal(copy.categoryId, "");
  assert.equal(copy.amountInput, "13.200");
});

test("transfer copies two different active accounts, without category or recurrence", () => {
  const copy = draftFromTransaction({
    ...base, transaction_type: "transfer",
    account_id: ACC_A, destination_account_id: ACC_B, category_id: CAT_A,
  }, [ACC_A, ACC_B], [CAT_A], now);
  assert.equal(copy.transactionType, "transfer");
  assert.equal(copy.destinationAccountId, ACC_B);
  assert.equal(copy.categoryId, "");
  assert.equal(copy.recurring, false);

  const noDest = draftFromTransaction({
    ...base, transaction_type: "transfer",
    destination_account_id: ACC_A,
  }, [ACC_A, ACC_B], [CAT_A], now);
  assert.equal(noDest.destinationAccountId, "");
});

test("draft storage accepts only complete, well-shaped entry fields", () => {
  const d = defaultEntryDraft(ACC_A, now);
  assert.equal(isEntryDraft(d), true);
  assert.equal(isEntryDraft({ ...d, transactionType: "bill" }), false);
  assert.equal(isEntryDraft({ ...d, amountInput: "1".repeat(31) }), false);
  assert.equal(isEntryDraft({ ...d, recurring: "yes" }), false);
  assert.equal(isEntryDraft([]), false);
  assert.equal(isEntryDraft(null), false);
});
