import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { createTransactionsXlsx } from "../lib/xlsx-export.mjs";

/** Read the ZIP local entries and validate their declared compressed sizes. */
function entries(binary) {
  const files = new Map();
  let offset = 0;
  while (offset + 4 <= binary.length &&
         binary.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(binary.readUInt16LE(offset + 8), 8, "ZIP entry must use DEFLATE");
    const compressed = binary.readUInt32LE(offset + 18);
    const uncompressed = binary.readUInt32LE(offset + 22);
    const nameLength = binary.readUInt16LE(offset + 26);
    const extraLength = binary.readUInt16LE(offset + 28);
    const name = binary.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const xml = inflateRawSync(binary.subarray(start, start + compressed));
    assert.equal(xml.length, uncompressed, "ZIP entry length mismatch");
    files.set(name, xml.toString("utf8"));
    offset = start + compressed;
  }
  assert.equal(binary.readUInt32LE(offset), 0x02014b50, "ZIP central directory present");
  assert.equal(binary.readUInt32LE(binary.length - 22), 0x06054b50, "ZIP end-of-central-directory present");
  return files;
}

test("Excel export is a real ZIP-based XLSX workbook with sortable dates and IDR amounts", () => {
  const zip = createTransactionsXlsx([
    ["2026-11-04", "Pemasukan", 10000, "Bonus", "BCAAA", "", "Uang masuk", "", "Manual"],
    ["2026-11-05", "Pengeluaran", 25000, "Belanja", "Dompet", "", "Bayar", "Toko", "Gmail"],
  ]);
  assert.equal(zip.subarray(0, 2).toString("ascii"), "PK");
  const files = entries(zip);
  for (const part of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(files.has(part), "Missing OOXML package part: " + part);
  }
  const sheet = files.get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /<autoFilter ref="A1:I3"\/>/);
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /<c r="A2" s="2"><v>46330<\/v><\/c>/);
  assert.match(sheet, /<c r="C2" s="3"><v>10000<\/v><\/c>/);
  assert.match(sheet, /<c r="C3" s="3"><v>25000<\/v><\/c>/);
  assert.match(files.get("xl/styles.xml"), /formatCode="&quot;Rp&quot; #,##0"/);
  assert.match(files.get("xl/workbook.xml"), /name="Transaksi"/);
});

test("Excel cells never evaluate untrusted notes as formulas", () => {
  const sheet = entries(createTransactionsXlsx([
    ["2026-11-04", "Pengeluaran", 1, "Kategori", "Akun", "",
      "=HYPERLINK(\"https://evil.example\", \"click\")", "<tag>&Hello", "Manual"],
  ])).get("xl/worksheets/sheet1.xml");
  assert.ok(!sheet.includes("<f>"), "No Excel formula elements may be emitted");
  assert.match(sheet, /<t xml:space="preserve">=HYPERLINK\(&quot;https:\/\//);
  assert.match(sheet, /&lt;tag&gt;&amp;Hello/);
});

test("Empty ledger creates a valid header-only workbook", () => {
  const sheet = entries(createTransactionsXlsx([])).get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /<autoFilter ref="A1:I1"\/>/);
  assert.ok(!sheet.includes('<row r="2"'));
});

test("Nonfinite, unsafe, invalid dates, and malformed rows fail closed", () => {
  const row = ["2026-11-04", "Pengeluaran", 1000, "", "", "", "", "", "Manual"];
  assert.throws(() => createTransactionsXlsx([[...row.slice(0, 2), NaN, ...row.slice(3)]]));
  assert.throws(() => createTransactionsXlsx([[...row.slice(0, 2), Number.MAX_SAFE_INTEGER + 1, ...row.slice(3)]]));
  assert.throws(() => createTransactionsXlsx([["2026-02-30", ...row.slice(1)]]));
  assert.throws(() => createTransactionsXlsx([row.slice(0, 7)]));
});
