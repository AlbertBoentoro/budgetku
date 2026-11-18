import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function loadTs(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  const compiledModule = { exports: {} };
  const requireLocal = (name) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error("Unexpected import: " + name);
  };
  new Function("module", "exports", "require", code)(
    compiledModule,
    compiledModule.exports,
    requireLocal,
  );
  return compiledModule.exports;
}

const money = loadTs("../lib/gmail/parsers/money.ts");
const { bcaParser } = loadTs("../lib/gmail/parsers/bca.ts", { "./money": money });
const input = { subject: "myBCA notification", from: "notifications@bca.co.id", receivedAt: "2026-11-18T03:00:00.000Z" };

test("actual myBCA transfer fields become a bank transfer card, not raw bank text", () => {
  const bodyText = `
Status : Successful
Transaction Date : 17 Nov 2026 14:26:36
Transfer Type : Transfer to BCA Account
Source of Fund : 1234****50
Beneficiary Account : 1234567890
Beneficiary Name : ANDI PRATAMA
Transfer Amount : IDR 8,750.00
Reference No. : DEMO-REFERENCE
`;
  const result = bcaParser.parse({ ...input, bodyText });
  assert.equal(result.ok, true);
  assert.equal(result.amount, 8750);
  assert.equal(result.transactionAt, "2026-11-17");
  assert.equal(result.description, "Transfer ke BCA");
  assert.equal(result.merchant, "ANDI PRATAMA");
  assert.equal(result.direction, "expense");
});

test("actual myBCA QRIS fields become a QRIS card with merchant", () => {
  const bodyText = `
Status : Successful
Transaction Date : 15 Nov 2026 19:14:43
Transaction Type : QRIS Payment
Payment to : TOKO KOPI KENANGA
Merchant Location : JAKARTA UTARA
Source of Fund : TAHAPAN XPRESI - 1234****50
Total Payment : IDR 11,000.00
Reference No. : DEMO-REFERENCE
`;
  const result = bcaParser.parse({ ...input, bodyText });
  assert.equal(result.ok, true);
  assert.equal(result.amount, 11000);
  assert.equal(result.transactionAt, "2026-11-15");
  assert.equal(result.description, "Transaksi QRIS");
  assert.equal(result.merchant, "TOKO KOPI KENANGA");
  assert.equal(result.direction, "expense");
});

test("flattened myBCA bank transfer stops fields at their boundaries", () => {
  const bodyText = "Status : Successful Transaction Date : 17 Nov 2026 14:26:36 Transfer Type : Transfer to BCA Account Source of Fund : 0954xxxx50 Source Currency : IDR - Indonesian Rupiah Beneficiary Account : 2290527913 Transfer Currency : IDR - Indonesian Rupiah Beneficiary Name : NICHOLAS YUWITO Transfer Amount : IDR 8,750.00 Remarks : - Reference No. : DEMO";
  const result = bcaParser.parse({ ...input, bodyText });
  assert.equal(result.description, "Transfer ke BCA");
  assert.equal(result.merchant, "NICHOLAS YUWITO");
  assert.equal(result.amount, 8750);
  assert.equal(result.confidence, "high");
});

test("multiline myBCA ShopeePay top-up preserves masked Name exactly", () => {
  const bodyText = [
    "Status : Successful",
    "Transaction Date : 18 Nov 2026 10:21:30",
    "Transaction Type : e-Wallet - SHOPEEPAY",
    "Source of Fund : 0954xxxx50",
    "Name : TESXXX NAMXXXXX",
    "Phone No. : 0851 - 2152 - 1023",
    "Amount : IDR 52,000.00",
    "Admin Fee : IDR 0.00",
    "Total Payment : IDR 52,000.00",
    "Reference No. : DEMO",
  ].join("\n");
  const result = bcaParser.parse({ ...input, bodyText });
  assert.equal(result.ok, true);
  assert.equal(result.description, "Top up ke ShopeePay");
  assert.equal(result.merchant, "TESXXX NAMXXXXX");
  assert.equal(result.amount, 52000);
  assert.equal(result.transactionAt, "2026-11-18");
  assert.equal(result.direction, "expense");
  assert.equal(result.confidence, "high");
});

test("flattened myBCA ShopeePay top-up never merges Name with bank/phone/amount fields", () => {
  const bodyText = "Transaction Date : 18 Nov 2026 10:21:30 Transaction Type : e-Wallet - SHOPEEPAY Source of Fund : 0954xxxx50 Name : TESXXX NAMXXXXX Phone No. : 0851-2152-1023 Amount : IDR 52,000.00 Admin Fee : IDR 0.00 Total Payment : IDR 52,000.00 Reference No. : DEMO";
  const result = bcaParser.parse({ ...input, bodyText });
  assert.equal(result.description, "Top up ke ShopeePay");
  assert.equal(result.merchant, "TESXXX NAMXXXXX");
  assert.equal(result.amount, 52000);
});

test("flattened QRIS uses only Payment to for merchant", () => {
  const bodyText = "Transaction Date : 15 Nov 2026 19:14:43 Transaction Type : QRIS Payment Payment to : Qpon Digital Goods 43 Merchant Location : JAKARTA UTARA Acquirer : BANK NOBU Merchant PAN : 936000 Terminal ID : A01 Source of Fund : TAHAPAN XPRESI Total Payment : IDR 11,000.00 Reference No. : DEMO";
  const result = bcaParser.parse({ ...input, bodyText });
  assert.equal(result.description, "Transaksi QRIS");
  assert.equal(result.merchant, "Qpon Digital Goods 43");
  assert.equal(result.amount, 11000);
  assert.equal(result.confidence, "high");
});

test("missing masked Name stays missing rather than substituting a phone or bank account", () => {
  const bodyText = "Transaction Date : 18 Nov 2026 10:21:30 Transaction Type : e-Wallet - SHOPEEPAY Source of Fund : 0954xxxx50 Phone No. : 0851-2152-1023 Total Payment : IDR 52,000.00";
  const result = bcaParser.parse({ ...input, bodyText });
  assert.equal(result.description, "Top up ke ShopeePay");
  assert.equal(result.merchant, null);
  assert.equal(result.confidence, "low");
});
