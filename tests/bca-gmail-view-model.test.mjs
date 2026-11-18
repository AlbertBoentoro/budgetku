import test from "node:test";
import assert from "node:assert/strict";
import { getBcaGmailViewModel } from "../lib/gmail/bca-view-model.ts";

const base = {
  source: "bca",
  amount: 8750,
  direction: "expense",
  transactionAt: "2026-11-17",
  merchant: "ANDI PRATAMA (DEMO)",
  description: "Transfer ke BCA",
  confidence: "high",
};

test("BCA transfer preview keeps title, amount, date, and recipient separate", () => {
  assert.deepEqual(getBcaGmailViewModel(base), {
    title: "Transfer ke BCA",
    date: "2026-11-17",
    recipient: "ANDI PRATAMA (DEMO)",
    amount: 8750,
    direction: "expense",
  });
});

test("BCA QRIS preview uses shop as recipient and preserves cents", () => {
  const result = getBcaGmailViewModel({
    ...base,
    description: "Transaksi QRIS",
    merchant: "TOKO KOPI KENANGA (DEMO)",
    amount: 250000.41,
    transactionAt: "2026-11-16",
  });
  assert.equal(result.title, "Transaksi QRIS");
  assert.equal(result.recipient, "TOKO KOPI KENANGA (DEMO)");
  assert.equal(result.amount, 250000.41);
});

test("ambiguous legacy BCA drafts do not invent a QRIS or transfer title", () => {
  assert.equal(getBcaGmailViewModel({
    ...base,
    merchant: "Grab",
    description: "Contoh email staging, bukan transaksi nyata",
  }).title, "Transaksi BCA");
});
