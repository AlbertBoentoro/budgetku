import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRestorePreview, RESTORE_TABLES } from "../lib/settings/restore-plan-core.mjs";

function fixture() {
  const userId = randomUUID();
  const account = { id: randomUUID(), user_id: userId, name: "Test Cash", initial_balance: 1000000 };
  const category = { id: randomUUID(), user_id: userId, is_system: false, category_type: "expense", name: "Test" };
  const txn = { id: randomUUID(), user_id: userId, account_id: account.id, category_id: category.id,
    destination_account_id: null, transaction_type: "expense", amount: 25000,
    currency: "IDR", transaction_at: "2026-11-02T00:00:00Z",
    source: "email", source_reference: "synthetic-gmail-id" };
  const data = Object.fromEntries(RESTORE_TABLES.map(t => [t, []]));
  data.accounts.push(account);
  data.categories.push(category);
  data.transactions.push(txn);
  data.preferences = null;
  const backup = { format: "budgetku-backup", version: 1, generatedAt: "2026-11-02T00:00:00Z", data };
  return { userId, account, category, txn, backup };
}

describe("Restore preview safety", () => {
  it("accepts unchanged synthetic backup without writing", () => {
    const { userId, txn, backup } = fixture();
    const preview = createRestorePreview({ userId, incoming: structuredClone(backup),
      current: structuredClone(backup), linkedTransactionIds: [txn.id] });
    assert.equal(preview.previewOnly, true);
    assert.equal(preview.eligibleForAtomicRestore, true);
    assert.deepEqual(preview.blockers, []);
    assert.equal(preview.tables.transactions.wouldRemove, 0);
    assert.equal(preview.externalGmailLinks, 1);
  });
  it("refuses missing Gmail-linked transaction", () => {
    const { userId, txn, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.transactions = [];
    const preview = createRestorePreview({ userId, incoming, current: backup,
      linkedTransactionIds: [txn.id] });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("Gmail-linked")));
    assert.equal(preview.tables.transactions.wouldRemove, 1);
  });
  it("refuses to overwrite Gmail-linked financial identity", () => {
    const { userId, txn, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.transactions[0].amount += 100;
    const preview = createRestorePreview({ userId, incoming, current: backup,
      linkedTransactionIds: [txn.id] });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("Gmail-linked")));
  });
  it("refuses foreign-user data", () => {
    const { userId, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.transactions[0].user_id = randomUUID();
    const preview = createRestorePreview({ userId, incoming, current: backup });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("does not belong")));
  });
  it("refuses transactions referencing a missing account", () => {
    const { userId, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.accounts = [];
    const preview = createRestorePreview({ userId, incoming, current: backup });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("missing account_id")));
  });
  it("refuses duplicate row IDs", () => {
    const { userId, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.accounts.push({ ...incoming.data.accounts[0] });
    const preview = createRestorePreview({ userId, incoming, current: backup });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("duplicate")));
  });
  it("produces accurate added/changed/removed counts for unlinked records", () => {
    const { userId, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.transactions.push({ ...incoming.data.transactions[0], id: randomUUID(), source: "manual", source_reference: null });
    incoming.data.accounts[0].name = "Renamed";
    const preview = createRestorePreview({ userId, incoming, current: backup });
    assert.equal(preview.eligibleForAtomicRestore, true);
    assert.equal(preview.tables.accounts.wouldUpdate, 1);
    assert.equal(preview.tables.transactions.wouldAdd, 1);
  });
  it("blocks missing system categories and avoids counting global rows for deletion", () => {
    const { userId, backup } = fixture();
    const shared = { id: randomUUID(), user_id: null, name: "Shared", is_system: true, category_type: "expense" };
    const incoming = structuredClone(backup);
    incoming.data.categories.push(shared);
    const preview = createRestorePreview({ userId, incoming, current: backup });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("system category missing")));
    assert.equal(preview.tables.categories.wouldAdd, 0);
  });
  it("refuses invalid versions or missing tables", () => {
    const { userId, backup } = fixture();
    assert.throws(() => createRestorePreview({ userId,
      incoming: { ...backup, version: 2 }, current: backup }), /version/);
    const missing = structuredClone(backup);
    delete missing.data.accounts;
    assert.throws(() => createRestorePreview({ userId, incoming: missing, current: backup }), /accounts/);
  });
  it("blocks any Gmail-linked metadata or timestamp change, not just financial fields", () => {
    const { userId, txn, backup } = fixture();
    const changes = [
      ["description", "Changed note"],
      ["merchant", "Other merchant"],
      ["created_at", "2026-10-30T07:00:00Z"],
      ["updated_at", "2026-11-03T04:00:00Z"],
      ["is_reviewed", true],
    ];
    for (const [field, value] of changes) {
      const incoming = structuredClone(backup);
      incoming.data.transactions[0][field] = value;
      const preview = createRestorePreview({
        userId, incoming, current: backup, linkedTransactionIds: [txn.id],
      });
      assert.equal(preview.eligibleForAtomicRestore, false,
        `Gmail-linked change to ${field} must prevent restore`);
      assert.ok(preview.blockers.some(p => p.includes("Gmail-linked")), field);
      assert.equal(preview.tables.transactions.wouldUpdate, 1, field);
    }
  });
  it("blocks missing live Gmail-linked transaction even if backup contains it", () => {
    const { userId, txn, backup } = fixture();
    const current = structuredClone(backup);
    current.data.transactions = [];
    const preview = createRestorePreview({
      userId, incoming: backup, current, linkedTransactionIds: [txn.id],
    });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("Gmail-linked")));
  });
  it("permits a change to an unlinked transaction but reports the impact", () => {
    const { userId, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.transactions[0].merchant = "Edited merchant";
    const preview = createRestorePreview({
      userId, incoming, current: backup, linkedTransactionIds: [],
    });
    assert.equal(preview.eligibleForAtomicRestore, true);
    assert.equal(preview.tables.transactions.wouldUpdate, 1);
  });
  it("rejects a category hierarchy cycle", () => {
    const { userId, backup } = fixture();
    const incoming = structuredClone(backup);
    const first = incoming.data.categories[0];
    const second = { ...first, id: randomUUID(), name: "Child", parent_id: first.id };
    first.parent_id = second.id;
    incoming.data.categories.push(second);
    const preview = createRestorePreview({ userId, incoming, current: backup });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("cycle")));
  });
  it("refuses goal contributions that would reference a missing goal", () => {
    const { userId, backup } = fixture();
    const incoming = structuredClone(backup);
    incoming.data.goalContributions.push({
      id: randomUUID(), user_id: userId, goal_id: randomUUID(), amount: 100,
    });
    const preview = createRestorePreview({ userId, incoming, current: backup });
    assert.equal(preview.eligibleForAtomicRestore, false);
    assert.ok(preview.blockers.some(p => p.includes("missing goal_id")));
  });

});
