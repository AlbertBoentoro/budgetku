import { deflateRawSync } from "node:zlib";

/**
 * Minimal dependency-free OOXML writer for a single transaction worksheet.
 * Every user-controlled field is an inline string, NEVER a formula.
 * Dates and rupiah values are Excel numeric cells (filterable/sortable).
 *
 * This avoids bundling a spreadsheet parser or introducing dependencies into
 * the financial application solely for a read-only export.
 */
const text = (value) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
  .slice(0, 32767)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const HEADERS = [
  "Tanggal", "Jenis", "Nominal (Rp)", "Kategori",
  "Rekening", "Rekening tujuan", "Catatan", "Merchant", "Sumber",
];

/** Excel's 1900-date system. Dates are already normalized to YYYY-MM-DD. */
function excelDate(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Invalid transaction date for Excel export.");
  }
  const milliseconds = Date.parse(day + "T00:00:00.000Z");
  if (!Number.isFinite(milliseconds) ||
      new Date(milliseconds).toISOString().slice(0, 10) !== day) {
    throw new Error("Invalid transaction date for Excel export.");
  }
  return milliseconds / 86400000 + 25569;
}

function columnName(index) {
  let i = index + 1;
  let label = "";
  while (i > 0) {
    i -= 1;
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26);
  }
  return label;
}
function stringCell(address, value, style = 0) {
  return '<c r="' + address + '" s="' + style +
    '" t="inlineStr"><is><t xml:space="preserve">' +
    text(value) + "</t></is></c>";
}
function numberCell(address, value, style) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isSafeInteger(numeric) ||
      Math.abs(numeric) > 999999999999999) {
    throw new Error("Invalid rupiah value for Excel export.");
  }
  return '<c r="' + address + '" s="' + style + '"><v>' +
    numeric + "</v></c>";
}
function sheetXml(rows) {
  if (!Array.isArray(rows) || rows.length > 50000) {
    throw new Error("Too many transactions to export in one file.");
  }
  const lines = [];
  lines.push('<row r="1" ht="28" customHeight="1">' +
    HEADERS.map((header, i) => stringCell(columnName(i) + "1", header, 1)).join("") +
    "</row>");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length !== HEADERS.length) {
      throw new Error("Invalid transaction export columns.");
    }
    const values = row.map((value, col) => {
      const ref = columnName(col) + (i + 2);
      if (col === 0) {
        return '<c r="' + ref + '" s="2"><v>' + excelDate(value) + "</v></c>";
      }
      return col === 2 ? numberCell(ref, value, 3) : stringCell(ref, value);
    });
    lines.push('<row r="' + (i + 2) + '">' + values.join("") + "</row>");
  }
  const last = rows.length + 1;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1:I' + last + '"/>' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="18"/>' +
    '<cols>' + [14, 16, 19, 24, 24, 24, 40, 27, 16]
      .map((width, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) +
        '" width="' + width + '" customWidth="1"/>').join("") + '</cols>' +
    '<sheetData>' + lines.join("") + '</sheetData>' +
    '<autoFilter ref="A1:I' + last + '"/>' +
    '</worksheet>';
}
const contentTypes = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '</Types>';
const rootRelationships = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';
const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Transaksi" sheetId="1" r:id="rId1"/></sheets>' +
  '</workbook>';
const workbookRelationships = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';
const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>' +
  '<numFmt numFmtId="165" formatCode="&quot;Rp&quot; #,##0"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let i = 0; i < 8; i++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  CRC_TABLE[n] = value >>> 0;
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const members = [];
  const central = [];
  let offset = 0;
  for (const [name, xml] of files) {
    const filename = Buffer.from(name, "utf8");
    const input = Buffer.from(xml, "utf8");
    const compressed = deflateRawSync(input, { level: 6 });
    const checksum = crc32(input);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // DEFLATE
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(input.length, 22);
    local.writeUInt16LE(filename.length, 26);
    members.push(local, filename, compressed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(input.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const centralData = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...members, centralData, end]);
}

export function createTransactionsXlsx(rows) {
  return zip([
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rootRelationships],
    ["xl/workbook.xml", workbook],
    ["xl/_rels/workbook.xml.rels", workbookRelationships],
    ["xl/styles.xml", styles],
    ["xl/worksheets/sheet1.xml", sheetXml(rows)],
  ]);
}
