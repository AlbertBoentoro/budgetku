import { deflateRawSync } from "node:zlib";

export type TransactionExcelRow = {
  tanggal: string;
  tipe: string;
  jumlah: number;
  kategori: string | null;
  rekening: string | null;
  rekening_tujuan: string | null;
  catatan: string | null;
  merchant: string | null;
  sumber: string;
};

// Keep each export bounded. A failed export is safer than a truncated workbook.
// Excel itself supports 1,048,576 rows, but serverless memory is more limited.
export const MAX_EXPORT_TRANSACTIONS = 100_000;

const HEADERS = [
  "Tanggal",
  "Jenis transaksi",
  "Nominal (Rp)",
  "Kategori",
  "Rekening",
  "Rekening tujuan",
  "Catatan",
  "Merchant",
  "Sumber",
];

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

// Always write arbitrary user-supplied values as inline strings, never as
// <f> formulas. Strip codepoints XML 1.0 cannot represent.
function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "\uFFFD")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function inlineCell(ref: string, text: string | null, style = 0): string {
  if (text === null || text === "") return "";
  const styleAttr = style ? ' s="' + style + '"' : "";
  return '<c r="' + ref + '"' + styleAttr +
    ' t="inlineStr"><is><t xml:space="preserve">' +
    escapeXml(text) + "</t></is></c>";
}

function dateCell(ref: string, raw: string): string {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = match ? Date.parse(raw + "T00:00:00.000Z") : NaN;
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== raw ||
      date < Date.UTC(1900, 0, 1)) {
    return inlineCell(ref, raw);
  }
  // Excel's 1900 date system: 1970-01-01 = serial 25569.
  const serial = Math.round(date / 86_400_000) + 25569;
  return '<c r="' + ref + '" s="2"><v>' + serial + "</v></c>";
}

function amountCell(ref: string, amount: number): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("Invalid transaction amount in Excel export");
  }
  return '<c r="' + ref + '" s="3"><v>' + String(amount) + "</v></c>";
}

function worksheet(rows: TransactionExcelRow[]): string {
  const data: string[] = [
    '<row r="1" ht="28" customHeight="1">' +
    HEADERS.map((title, i) =>
      inlineCell(String.fromCharCode(65 + i) + "1", title, 1),
    ).join("") + "</row>",
  ];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const n = index + 2;
    const str = String(n);
    data.push(
      '<row r="' + str + '">' +
      dateCell("A" + str, row.tanggal) +
      inlineCell("B" + str, row.tipe) +
      amountCell("C" + str, row.jumlah) +
      inlineCell("D" + str, row.kategori) +
      inlineCell("E" + str, row.rekening) +
      inlineCell("F" + str, row.rekening_tujuan) +
      inlineCell("G" + str, row.catatan) +
      inlineCell("H" + str, row.merchant) +
      inlineCell("I" + str, row.sumber) +
      "</row>",
    );
  }
  const widths = [17, 20, 20, 29, 26, 26, 42, 30, 18];
  const cols = widths.map((width, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) +
    '" width="' + width + '" customWidth="1"/>',
  ).join("");
  const lastRow = Math.max(1, rows.length + 1);
  return XML +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1:I' + lastRow + '"/>' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19"/><cols>' + cols + "</cols>" +
    "<sheetData>" + data.join("") + "</sheetData>" +
    '<autoFilter ref="A1:I' + lastRow + '"/>' +
    '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    "</worksheet>";
}

const STYLES = XML +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="165" formatCode="dd mmm yyyy"/>' +
  '<numFmt numFmtId="166" formatCode="&quot;Rp&quot; #,##0.##"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font>' +
  '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const CONTENT_TYPES = XML +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS = XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="' + OFFICE_REL_NS +
  '/officeDocument" Target="xl/workbook.xml"/></Relationships>';

const WORKBOOK = XML +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' +
  OFFICE_REL_NS + '"><sheets><sheet name="Transaksi" sheetId="1" r:id="rId1"/></sheets></workbook>';

const WORKBOOK_RELS = XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="' + OFFICE_REL_NS +
  '/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="' + OFFICE_REL_NS +
  '/styles" Target="styles.xml"/></Relationships>';

// XLSX is a ZIP container. Write conforming local headers + central directory
// with CRC32; native zlib avoids adding an unpinned transitive dependency.
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<[string, string]>): Uint8Array {
  const locals: Buffer[] = [];
  const centers: Buffer[] = [];
  let offset = 0;
  for (const [path, xml] of files) {
    const name = Buffer.from(path, "utf8");
    const data = Buffer.from(xml, "utf8");
    const zipped = deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(zipped.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, zipped);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(zipped.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centers.push(central, name);
    offset += local.length + name.length + zipped.length;
  }
  const centralSize = centers.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Uint8Array.from(Buffer.concat([...locals, ...centers, end]));
}

export function createTransactionXlsx(rows: TransactionExcelRow[]): Uint8Array {
  if (rows.length > MAX_EXPORT_TRANSACTIONS) {
    throw new Error("Transaction export exceeds server-safe Excel row limit");
  }
  return zip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["xl/workbook.xml", WORKBOOK],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", worksheet(rows)],
  ]);
}
