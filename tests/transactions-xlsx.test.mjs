import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import test from "node:test";

import {
  createTransactionXlsx,
  MAX_EXPORT_TRANSACTIONS,
} from "../lib/export/transactions-xlsx.ts";

function parts(archive) {
  const zipped = Buffer.from(archive);
  const data = new Map();
  let at = 0;
  while (zipped.readUInt32LE(at) === 0x04034b50) {
    const compressedLength = zipped.readUInt32LE(at + 18);
    const nameLength = zipped.readUInt16LE(at + 26);
    const extraLength = zipped.readUInt16LE(at + 28);
    const name = zipped.subarray(at + 30, at + 30 + nameLength).toString();
    const begin = at + 30 + nameLength + extraLength;
    const raw = inflateRawSync(zipped.subarray(begin, begin + compressedLength));
    assert.equal(raw.length, zipped.readUInt32LE(at + 22));
    data.set(name, raw.toString("utf8"));
    at = begin + compressedLength;
  }
  assert.equal(zipped.readUInt32LE(at), 0x02014b50, "central directory must exist");
  assert.equal(zipped.readUInt32LE(zipped.length - 22), 0x06054b50, "ZIP end record must exist");
  assert.equal(zipped.readUInt16LE(zipped.length - 12), data.size, "ZIP entry count");
  return data;
}

test("real XLSX contains the Excel package and numeric amount cells", () => {
  const excel = createTransactionXlsx([{
    tanggal: "2026-11-05",
    tipe: "Pengeluaran",
    jumlah: 165000,
    kategori: "Makan & Minum",
    rekening: "BCA",
    rekening_tujuan: null,
    catatan: "Makan siang",
    merchant: "Warung",
    sumber: "Manual",
  }]);
  assert.equal(excel[0], 0x50);
  assert.equal(excel[1], 0x4b);
  const files = parts(excel);
  assert.equal(files.size, 6);
  assert.match(files.get("[Content_Types].xml"), /spreadsheetml\.sheet\.main\+xml/);
  assert.match(files.get("xl/workbook.xml"), /sheet name="Transaksi"/);
  const sheet = files.get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /autoFilter ref="A1:I2"/);
  assert.match(sheet, /pane ySplit="1"/);
  assert.match(sheet, /<c r="C2" s="3"><v>165000<\/v><\/c>/);
  assert.match(sheet, /<c r="A2" s="2"><v>46331<\/v><\/c>/);
  assert.match(sheet, /Makan &amp; Minum/);
  assert.match(files.get("xl/styles.xml"), /&quot;Rp&quot; #,##0\.##/);
});

test("unsafe spreadsheet-looking text is always literal, never an executable formula", () => {
  const sheet = parts(createTransactionXlsx([{
    tanggal: "2026-11-05", tipe: "Pemasukan", jumlah: 1,
    kategori: null, rekening: "Kas", rekening_tujuan: null,
    catatan: "=HYPERLINK(\"https://example.invalid\")",
    merchant: "+SUM(1,2) <script>", sumber: "Manual",
  }])).get("xl/worksheets/sheet1.xml");
  assert.doesNotMatch(sheet, /<f(?:\s|>)/);
  assert.match(sheet, /<c r="G2" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/);
  assert.match(sheet, /&lt;script&gt;/);
  assert.match(sheet, /&quot;https:\/\/example.invalid&quot;/);
});

test("empty transaction history still exports header-only Excel", () => {
  const sheet = parts(createTransactionXlsx([])).get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /autoFilter ref="A1:I1"/);
  assert.doesNotMatch(sheet, /<row r="2"/);
});

test("invalid values and oversize workbooks fail without producing partial Excel", () => {
  assert.throws(() => createTransactionXlsx([{
    tanggal:"2026-11-05", tipe:"X", jumlah:Number.NaN,
    kategori:null, rekening:null, rekening_tujuan:null,
    catatan:null, merchant:null, sumber:"Manual",
  }]), /Invalid transaction amount/);
  const bad = Array(MAX_EXPORT_TRANSACTIONS + 1).fill({
    tanggal:"2026-11-05", tipe:"X", jumlah:5, kategori:null, rekening:null,
    rekening_tujuan:null, catatan:null, merchant:null, sumber:"Manual",
  });
  assert.throws(() => createTransactionXlsx(bad), /row limit/);
});
