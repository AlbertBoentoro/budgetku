import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTransactionAmountInput,
  parseTransactionAmountInput,
  transactionAmountInputFromValue,
} from "../lib/transaction-amount-input.ts";
import { addIdrAmounts, formatIdrCurrency, isValidIdrAmount, isValidTransactionIdrAmount } from "../lib/idr-money.ts";

test("integer IDR input groups four digits and keeps Rp separate", () => {
  assert.equal(formatTransactionAmountInput("1234"), "1.234");
  assert.equal(formatTransactionAmountInput("123456789"), "123.456.789");
  assert.equal(formatTransactionAmountInput("1.2345"), "12.345");
  assert.equal(formatTransactionAmountInput("12.50", "12.500"), "1.250");
  assert.equal(formatTransactionAmountInput("0001234"), "1.234");
  assert.equal(formatTransactionAmountInput("000"), "0");
  assert.equal(formatTransactionAmountInput(""), "");
});

test("formatted IDR is parsed without changing stored amount", () => {
  assert.equal(parseTransactionAmountInput("1.234"), 1234);
  assert.equal(parseTransactionAmountInput("12.345.678"), 12345678);
  assert.equal(parseTransactionAmountInput("0"), 0);
  assert.equal(parseTransactionAmountInput(""), null);
  assert.equal(parseTransactionAmountInput("1.23"), null);
  assert.equal(parseTransactionAmountInput("12,50"), 12.5);
  assert.equal(parseTransactionAmountInput("abc"), null);
  assert.equal(parseTransactionAmountInput("Rp 1.250"), null);
  assert.equal(parseTransactionAmountInput("-100"), null);
  assert.equal(parseTransactionAmountInput("9.007.199.254.740.992"), null);
  assert.equal(parseTransactionAmountInput("9.007.199.254.740.991"), Number.MAX_SAFE_INTEGER);
});

test("presets use the same formatted input and preserve whole rupiah", () => {
  const base = parseTransactionAmountInput(formatTransactionAmountInput("145000"));
  assert.equal(base, 145000);
  const afterPreset = formatTransactionAmountInput(String(base + 50000));
  assert.equal(afterPreset, "195.000");
  assert.equal(parseTransactionAmountInput(afterPreset), 195000);
});

test("Indonesian sen input formats 0,41 and grouped thousands", () => {
  assert.equal(formatTransactionAmountInput("0,41"), "0,41");
  assert.equal(formatTransactionAmountInput("0.41"), "0,41");
  assert.equal(formatTransactionAmountInput("1234,41"), "1.234,41");
  assert.equal(formatTransactionAmountInput("261157,41"), "261.157,41");
  assert.equal(formatTransactionAmountInput("1.234,41"), "1.234,41");
  assert.equal(formatTransactionAmountInput("1234.41"), "1.234,41");
  assert.equal(formatTransactionAmountInput("0,"), "0,");
  assert.equal(parseTransactionAmountInput("0,"), null);
  assert.equal(parseTransactionAmountInput("0,41"), 0.41);
  assert.equal(parseTransactionAmountInput("1.234,41"), 1234.41);
  assert.equal(parseTransactionAmountInput("12,345"), null);
  assert.equal(parseTransactionAmountInput("1.23,41"), null);
  assert.equal(transactionAmountInputFromValue(261157.41), "261.157,41");
  assert.equal(transactionAmountInputFromValue(0.41), "0,41");
});

test("fractional server validation, presets and display keep exact sen", () => {
  assert.equal(isValidIdrAmount(0.41), true);
  assert.equal(isValidIdrAmount(0.41, true), true);
  assert.equal(isValidIdrAmount(0), false);
  assert.equal(isValidIdrAmount(0, true), true);
  assert.equal(isValidIdrAmount(1.234), false);
  assert.equal(isValidIdrAmount(-0.41), false);
  assert.equal(isValidIdrAmount(Infinity), false);
  assert.equal(isValidTransactionIdrAmount(0.41), true);
  assert.equal(isValidTransactionIdrAmount(1_000_000_000_000), true);
  assert.equal(isValidTransactionIdrAmount(1_000_000_000_000.01), false);
  assert.equal(addIdrAmounts(0.41, 50000), 50000.41);
  assert.equal(formatIdrCurrency(2321257.41).replace(/\s/g, ""), "Rp2.321.257,41");
  assert.equal(formatIdrCurrency(3000).replace(/\s/g, ""), "Rp3.000");
});

test("type-colored icon classes include every transaction direction", async () => {
  const { transactionTypeIconClass } = await import("../lib/transaction-type-tone.ts");
  assert.match(transactionTypeIconClass("expense"), /text-expense/);
  assert.match(transactionTypeIconClass("income"), /text-income/);
  assert.match(transactionTypeIconClass("transfer"), /text-primary/);
  assert.notEqual(transactionTypeIconClass("transfer"), transactionTypeIconClass("expense"));
});
