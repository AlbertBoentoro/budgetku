import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function loadTs(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", code)(mod, mod.exports, name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error("Unexpected import: " + name);
  });
  return mod.exports;
}
const money = loadTs("../lib/gmail/parsers/money.ts");
const { grabParser } = loadTs("../lib/gmail/parsers/grab.ts", { "./money": money });
const input = { subject: "Your Grab E-Receipt", from: "Grab <no-reply@grab.com>", receivedAt: "2026-11-23T23:14:02Z" };
test("ride uses paid total, local trip date and pickup to destination", () => {
  const result = grabParser.parse({ ...input, bodyText: [
    "Bike Hemat", "Picked up on 24 November 2026", "Booking ID: DEMO",
    "Total Paid", "Rp7.500", "Fare", "9.000", "Promo/ Discount", "-1.500",
    "Your Trip", "3.35 km • 6 mins", "⋮", "Demo Pickup", "6:07AM",
    "Demo Destination", "6:13AM", "PT Grab Teknologi Indonesia",
  ].join("\n") });
  assert.deepEqual(result, { ok: true, amount: 7500, direction: "expense", transactionAt: "2026-11-24", merchant: "Grab", description: "Demo Pickup ke Demo Destination", confidence: "high" });
});
test("flattened car receipt includes fees in final paid total", () => {
  const result = grabParser.parse({ ...input, bodyText: "Car Plus Picked up on 24 November 2026 Total Paid Rp33.500 Fare 23.000 Ride Cover 2.000 Platform Fee 8.500 Your Trip 6.19 km • 28 mins ⋮ Demo Tower 12:15PM Demo Mall 12:43PM PT Grab Teknologi Indonesia" });
  assert.equal(result.amount, 33500);
  assert.equal(result.description, "Demo Tower ke Demo Mall");
});
test("GrabFood group order chooses personal charge rather than group total", () => {
  const result = grabParser.parse({ ...input, bodyText: "Selamat menikmati makanan Anda!\nTOTAL\nRp 17799\nTANGGAL | WAKTU\n24 Nov 26 10:44 +0700\nGroup Order GrabFood\nPesanan Dari:\nDemo Restaurant\nTOTAL\nRp 94200\nKamu membayar\nRp 17799" });
  assert.equal(result.amount, 17799);
  assert.equal(result.transactionAt, "2026-11-24");
  assert.equal(result.description, "Demo Restaurant");
});
test("group order with no personal charge fails closed", () => {
  assert.equal(grabParser.parse({ ...input, bodyText: "Group Order GrabFood\nTOTAL\nRp 94200" }).ok, false);
});
test("missing ride amount never falls back to fare or tax", () => {
  assert.equal(grabParser.parse({ ...input, bodyText: "Picked up on 24 November 2026\nFare Rp9.000\nVAT Rp12" }).ok, false);
});
test("missing route does not fabricate location", () => {
  const result = grabParser.parse({ ...input, bodyText: "Picked up on 24 November 2026\nTotal Paid Rp7.500" });
  assert.equal(result.description, null);
  assert.equal(result.confidence, "low");
});
test("unrelated subject is rejected", () => {
  assert.equal(grabParser.parse({ ...input, subject: "Grab promotion", bodyText: "Picked up on 24 November 2026 Total Paid Rp7.500" }).ok, false);
});
