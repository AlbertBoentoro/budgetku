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
  const module = { exports: {} };
  const requireLocal = (name) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error("Unexpected import: " + name);
  };
  new Function("module", "exports", "require", code)(
    module,
    module.exports,
    requireLocal,
  );
  return module.exports;
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
