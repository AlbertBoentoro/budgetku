// F-03 (audit PR #31): editing a transaction must keep its provenance.
// Pure tests of the real payload builders, plus a check that the server
// actions use the right builder for insert and update. No database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTransactionInsertPayload,
  buildTransactionUpdatePayload,
} from "../lib/transactions/payload.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const EXPENSE_ACCOUNT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const OTHER_ACCOUNT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const CATEGORY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

// What the edit form sends after a user changes the amount and the note.
const edit = {
  transaction_type: "expense",
  amount: 82000,
  account_id: EXPENSE_ACCOUNT,
  destination_account_id: null,
  category_id: CATEGORY,
  transaction_at: "2026-11-03",
  description: "Makan siang (dikoreksi)",
  merchant: "Warung demo",
};

// Stored rows as they exist before the edit, one per kind of provenance.
function storedRow(source, source_reference) {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    user_id: USER,
    account_id: EXPENSE_ACCOUNT,
    destination_account_id: null,
    category_id: CATEGORY,
    transaction_type: "expense",
    amount: 80000,
    currency: "IDR",
    transaction_at: "2026-11-03",
    description: "Makan siang",
    merchant: "Warung demo",
    source,
    source_reference,
  };
}

const STORED = {
  manual: storedRow("manual", null),
  gmail: storedRow("email", "18c2f0a9b1d4e7f3"),
  recurring: storedRow("recurring", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1:2026-11-03"),
  initialRecurring: storedRow(
    "manual",
    "initial-recurring:9f0c1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b",
  ),
};

// What PostgREST does with an UPDATE: only the keys in the payload change.
const applyUpdate = (row, payload) => ({ ...row, ...payload });

test("a new manual transaction is created with source manual and no reference", () => {
  const payload = buildTransactionInsertPayload(USER, edit);
  assert.equal(payload.user_id, USER);
  assert.equal(payload.source, "manual");
  assert.equal(payload.source_reference, null);
  assert.equal(payload.amount, 82000);
  assert.equal(payload.currency, "IDR");
});

test("the update payload has no provenance or owner fields", () => {
  const payload = buildTransactionUpdatePayload(edit);
  for (const key of ["source", "source_reference", "user_id", "id"]) {
    assert.equal(Object.hasOwn(payload, key), false, `update payload must not contain ${key}`);
  }
});

for (const [kind, row] of Object.entries(STORED)) {
  test(`editing a ${kind} transaction keeps source and source_reference exactly`, () => {
    const after = applyUpdate(row, buildTransactionUpdatePayload(edit));
    assert.equal(after.source, row.source);
    assert.equal(after.source_reference, row.source_reference);
    assert.equal(after.user_id, row.user_id);
    assert.equal(after.id, row.id);
    // The edit itself is applied.
    assert.equal(after.amount, 82000);
    assert.equal(after.description, "Makan siang (dikoreksi)");
  });
}

test("an edited Gmail import is still found by the reconciliation lookup", () => {
  const after = applyUpdate(STORED.gmail, buildTransactionUpdatePayload(edit));
  // Same predicate as app/(app)/settings/gmail/actions.ts: source + message id.
  const found = [after].find(
    (r) => r.user_id === USER && r.source === "email" && r.source_reference === "18c2f0a9b1d4e7f3",
  );
  assert.ok(found);
});

test("an edited recurring occurrence keeps its duplicate-guard key", () => {
  const after = applyUpdate(STORED.recurring, buildTransactionUpdatePayload(edit));
  // transactions_source_reference_uidx is (user_id, source, source_reference).
  const key = (r) => `${r.user_id}|${r.source}|${r.source_reference}`;
  assert.equal(key(after), key(STORED.recurring));
});

test("form input cannot set provenance or owner, even when tampered", () => {
  const tampered = {
    ...edit,
    source: "email",
    source_reference: "forged-message-id",
    user_id: "22222222-2222-4222-8222-222222222222",
  };
  const update = buildTransactionUpdatePayload(tampered);
  assert.equal(Object.hasOwn(update, "source"), false);
  assert.equal(Object.hasOwn(update, "source_reference"), false);
  assert.equal(Object.hasOwn(update, "user_id"), false);

  const insert = buildTransactionInsertPayload(USER, tampered);
  assert.equal(insert.source, "manual");
  assert.equal(insert.source_reference, null);
  assert.equal(insert.user_id, USER);
});

test("payloads keep the transfer and category rules for both create and edit", () => {
  const transfer = {
    ...edit,
    transaction_type: "transfer",
    destination_account_id: OTHER_ACCOUNT,
    category_id: CATEGORY,
  };
  for (const payload of [
    buildTransactionInsertPayload(USER, transfer),
    buildTransactionUpdatePayload(transfer),
  ]) {
    assert.equal(payload.destination_account_id, OTHER_ACCOUNT);
    assert.equal(payload.category_id, null);
  }
  const expense = { ...edit, destination_account_id: OTHER_ACCOUNT };
  for (const payload of [
    buildTransactionInsertPayload(USER, expense),
    buildTransactionUpdatePayload(expense),
  ]) {
    assert.equal(payload.destination_account_id, null);
    assert.equal(payload.category_id, CATEGORY);
  }
});

test("create and edit write the same editable fields, so balances move the same way", () => {
  const insert = buildTransactionInsertPayload(USER, edit);
  const update = buildTransactionUpdatePayload(edit);
  const { user_id, source, source_reference, ...insertEditable } = insert;
  assert.equal(user_id, USER);
  assert.equal(source, "manual");
  assert.equal(source_reference, null);
  assert.deepEqual(update, insertEditable);
});

test("server actions use the insert builder for create and the update builder for edit", () => {
  const actions = readFileSync(new URL("../app/(app)/transactions/actions.ts", import.meta.url), "utf8");
  assert.match(actions, /\.insert\(buildTransactionInsertPayload\(user\.id, input\)\)/);
  assert.match(actions, /\.update\(buildTransactionUpdatePayload\(input\)\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(actions, /source:\s*"manual"/, "provenance must only be set in lib/transactions/payload.ts");
  assert.doesNotMatch(actions, /function buildPayload\b/);
});
