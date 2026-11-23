import assert from "node:assert/strict";
import test from "node:test";
import {
  openingBalanceForTarget,
  runningBalanceFromOpening,
} from "../lib/account-balance-adjustment.ts";

test("editing a current account balance preserves ledger effects", () => {
  const ledgerNet = 125000 - 30000 + 50000 - 10000;
  assert.equal(runningBalanceFromOpening(100000, ledgerNet), 235000);
  const newOpening = openingBalanceForTarget(200000, ledgerNet);
  assert.equal(newOpening, 65000);
  assert.equal(runningBalanceFromOpening(newOpening, ledgerNet), 200000);
});

test("no-op edit does not double-count the ledger", () => {
  assert.equal(openingBalanceForTarget(135000, 35000), 100000);
});

test("target can be zero even if incoming payments exceed it", () => {
  assert.equal(openingBalanceForTarget(0, 300000), -300000);
  assert.equal(runningBalanceFromOpening(-300000, 300000), 0);
});

test("fractional IDR remains exact in sen", () => {
  const opening = openingBalanceForTarget(261157.41, -1000.59);
  assert.equal(opening, 262158);
  assert.equal(runningBalanceFromOpening(opening, -1000.59), 261157.41);
});

test("invalid, unsafe and overly precise values are rejected", () => {
  for (const value of [Number.NaN, Infinity, -1, 0.123, 9007199254740992]) {
    assert.equal(openingBalanceForTarget(value, 100), null);
  }
  assert.equal(openingBalanceForTarget(100, Number.NaN), null);
  assert.equal(openingBalanceForTarget(100, 0.123), null);
  assert.equal(runningBalanceFromOpening(Infinity, 1), null);
});
