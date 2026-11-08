import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const card = readFileSync(
  new URL("../components/dashboard/net-balance-card.tsx", import.meta.url),
  "utf8",
);

test("net balance mobile typography caps at 32px and steps down for long IDR amounts", () => {
  // Current production example should fit a narrow phone without 11vw text.
  const amount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(2324257.41);
  assert.ok(amount.includes("2.324.257,41"));
  assert.ok(amount.length <= 18);
  assert.match(card, /balanceLength > 18/);
  assert.match(card, /balanceLength > 14/);
  assert.match(card, /text-\[clamp\(1\.375rem,6\.5vw,2rem\)\]/);
  assert.match(card, /text-\[clamp\(1\.25rem,5\.4vw,1\.875rem\)\]/);
  assert.match(card, /text-\[clamp\(1\.125rem,4\.4vw,1\.625rem\)\]/);
  assert.doesNotMatch(card, /text-\[clamp\(1rem,11vw,2\.75rem\)\]/);
});

test("eye button stays in header flow and never overlays the balance", () => {
  assert.doesNotMatch(card, /absolute right-2 top-2/);
  assert.match(card, /min-h-11 min-w-0 items-center gap-2/);
  assert.match(card, /size-11 shrink-0 items-center justify-center/);
  assert.match(card, /flex min-h-12 min-w-0 items-center/);
  assert.match(card, /block min-w-0 max-w-full overflow-hidden text-ellipsis/);
  assert.match(card, /aria-pressed=\{hidden\}/);
  assert.match(card, /Sembunyikan saldo/);
  assert.match(card, /Tampilkan saldo/);
});

test("balance remains unaltered, including cents, and hide/show preference persists", () => {
  assert.match(card, /value=\{balance\}/);
  assert.match(card, /maximumFractionDigits: 2/);
  assert.match(card, /BALANCE_MASK/);
  assert.match(card, /localStorage\.setItem\(HIDDEN_STORAGE_KEY/);
});
