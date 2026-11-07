import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTransactionAmountInput,
  parseTransactionAmountInput,
  transactionAmountInputFromValue,
} from "../lib/transaction-amount-input.ts";
import { addIdrAmounts, formatIdrCurrency, isValidIdrAmount } from "../lib/idr-money.ts";

test("integer IDR input groups four digits and keeps Rp separate", () => {
  assert.equal(formatTransactionAmountInput("1234"), "1.234");
  assert.equal(formatTransactionAmountInput("123456789"), "123.456.789");
  assert.equal(formatTransactionAmountInput("1.2345"), "12.345");
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
