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
    sourceLabel: "Transaksi BCA",
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
  }).title, "Jenis transaksi belum terbaca");
});

test("BCA wallet top up displays the masked owner and separates source from purpose", () => {
  const result = getBcaGmailViewModel({
    ...base,
    description: "Top up ke ShopeePay",
    merchant: "TESXXX NAMXXXXX",
    amount: 52000,
    transactionAt: "2026-11-18",
  });
  assert.equal(result.sourceLabel, "Transaksi BCA");
  assert.equal(result.title, "Top up ke ShopeePay");
  assert.equal(result.recipient, "TESXXX NAMXXXXX");
  assert.equal(result.amount, 52000);
});

test("old flattened email preview cannot leak account fields into Kepada", () => {
  const result = getBcaGmailViewModel({
    ...base,
    merchant: "Transfer to BCA Account Source of Fund : 123456 Beneficiary Name : SOMEONE",
    description: "myBCA transfer notification",
  });
  assert.equal(result.title, "Jenis transaksi belum terbaca");
  assert.equal(result.recipient, "Penerima belum terdeteksi");
});
