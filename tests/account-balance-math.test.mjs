import assert from "node:assert/strict";
import test from "node:test";
import {
  computeTransactionEffects,
  sumRunningAccountBalances,
} from "../lib/account-balance-math.ts";

test("income, expense, and transfer produce correct ledger deltas", () => {
  const effects = computeTransactionEffects([
    { account_id: "A", destination_account_id: null, amount: 300, transaction_type: "income" },
    { account_id: "A", destination_account_id: null, amount: 100, transaction_type: "expense" },
    { account_id: "A", destination_account_id: "B", amount: 200, transaction_type: "transfer" },
    { account_id: "B", destination_account_id: null, amount: 50, transaction_type: "income" },
  ]);
  assert.equal(effects.get("A"), 0);
  assert.equal(effects.get("B"), 250);
  // The pages pass RUNNING balances (opening + transaction delta), not
  // the transaction delta map directly.
  const balances = new Map([
    ["A", 1000 + (effects.get("A") ?? 0)],
    ["B", 50 + (effects.get("B") ?? 0)],
  ]);
  assert.equal(sumRunningAccountBalances([
    { id: "A", initial_balance: 1000, include_in_total: true },
    { id: "B", initial_balance: 50, include_in_total: true },
  ], balances), 1300);
});

test("excluded account does not enter the dashboard total", () => {
  const accounts = [
    { id: "A", initial_balance: 1000, include_in_total: true },
    { id: "B", initial_balance: 500, include_in_total: false },
  ];
  assert.equal(sumRunningAccountBalances(accounts, new Map()), 1000);
  assert.equal(sumRunningAccountBalances(accounts, new Map([["A", 800], ["B", 5000]])), 800);
});

test("a transfer between included accounts does not alter combined wealth", () => {
  const initial = [
    { id: "A", initial_balance: 800, include_in_total: true },
    { id: "B", initial_balance: 300, include_in_total: true },
  ];
  const effects = computeTransactionEffects([
    { account_id: "A", destination_account_id: "B", amount: 650, transaction_type: "transfer" },
  ]);
  assert.equal(effects.get("A"), -650);
  assert.equal(effects.get("B"), 650);
  const balances = new Map(initial.map((account) => [
    account.id, account.initial_balance + (effects.get(account.id) ?? 0),
  ]));
  assert.equal(sumRunningAccountBalances(initial, balances), 1100);
});

test("unexpected transaction types and invalid amounts do not poison sums", () => {
  const effects = computeTransactionEffects([
    { account_id: "A", destination_account_id: null, amount: Number.NaN, transaction_type: "income" },
    { account_id: "A", destination_account_id: null, amount: 200, transaction_type: "unknown" },
    { account_id: "A", destination_account_id: null, amount: 45, transaction_type: "expense" },
  ]);
  assert.equal(effects.get("A"), -45);
});

test("empty ledger returns initial balance, excluding opted-out accounts", () => {
  const effects = computeTransactionEffects([]);
  assert.deepEqual([...effects], []);
  assert.equal(sumRunningAccountBalances([
    { id: "cash", initial_balance: 125000, include_in_total: true },
    { id: "offline", initial_balance: 500000, include_in_total: false },
  ], effects), 125000);
});
