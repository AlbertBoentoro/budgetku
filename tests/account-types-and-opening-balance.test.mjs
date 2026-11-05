// F-02 (audit PR #31): account types the app writes must be accepted by the
// database, and the Saldo awal field shows and submits whole Rupiah.
// Pure tests; no database.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACCOUNT_TYPE_VALUES,
  LEGACY_ACCOUNT_TYPE_VALUES,
  canonicalAccountType,
  isAccountTypeValue,
  validateAccountInput,
} from "../lib/account-types.ts";
import {
  formatOpeningBalanceInput,
  openingBalanceInputFromValue,
  parseOpeningBalanceInput,
} from "../lib/opening-balance-input.ts";

// lib/accounts.ts uses the "@/..." alias; resolve it for plain Node.
const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      for (const suffix of ["", ".ts"]) {
        const url = new URL(specifier.slice(2) + suffix, root);
        if (existsSync(fileURLToPath(url)) && !url.pathname.endsWith("/")) {
          return { url: url.href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const read = (path) => readFileSync(new URL(path, root), "utf8");

// The values in the CHECK of the staged SQL patch.
function migrationCheckValues() {
  const sql = read("docs/sql/2026-11-account-types-align.sql");
  const check = /ADD CONSTRAINT accounts_account_type_check\s+CHECK \(account_type IN \(([^)]*)\)\)/.exec(sql);
  assert.ok(check, "CHECK not found in docs/sql/2026-11-account-types-align.sql");
  return [...check[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

// The live CHECK before the patch (production, read-only, 2026-11-05).
const LIVE_CHECK_BEFORE = ["bank", "cash", "ewallet", "credit_card", "investment", "other"];

const validInput = (account_type) => ({
  name: "Rekening demo",
  account_type,
  initial_balance: 150000,
});

// --- account types ---------------------------------------------------------

test("the form offers exactly the canonical account types", async () => {
  const { ACCOUNT_TYPES } = await import("../lib/accounts.ts");
  assert.deepEqual(ACCOUNT_TYPES.map((t) => t.value), [...ACCOUNT_TYPE_VALUES]);
  assert.deepEqual(
    [...ACCOUNT_TYPE_VALUES],
    ["cash", "bank", "ewallet", "credit_card", "savings", "investment"],
  );
});

test("every canonical type is accepted by the patched database CHECK", () => {
  const allowed = migrationCheckValues();
  for (const value of ACCOUNT_TYPE_VALUES) {
    assert.ok(allowed.includes(value), `${value} is not in the CHECK`);
  }
});

test("the patch only widens the live CHECK, so no existing row is rejected", () => {
  const allowed = migrationCheckValues();
  for (const value of LIVE_CHECK_BEFORE) {
    assert.ok(allowed.includes(value), `${value} would be dropped`);
  }
  for (const value of LEGACY_ACCOUNT_TYPE_VALUES) {
    assert.ok(allowed.includes(value), `legacy ${value} would be dropped`);
  }
  assert.deepEqual(
    allowed.filter((v) => !LIVE_CHECK_BEFORE.includes(v)),
    ["savings"],
    "only savings is new",
  );
});

test("without the patch, savings is the only canonical type the live CHECK still rejects", () => {
  assert.deepEqual(
    ACCOUNT_TYPE_VALUES.filter((v) => !LIVE_CHECK_BEFORE.includes(v)),
    ["savings"],
  );
});

for (const value of ACCOUNT_TYPE_VALUES) {
  test(`create and edit validation accept ${value} and write it unchanged`, () => {
    const { fieldErrors, accountType } = validateAccountInput(validInput(value));
    assert.deepEqual(fieldErrors, {});
    assert.equal(accountType, value);
  });
}

test("E-wallet: the old e_wallet spelling is saved as ewallet", () => {
  assert.equal(canonicalAccountType("e_wallet"), "ewallet");
  const { fieldErrors, accountType } = validateAccountInput(validInput("e_wallet"));
  assert.deepEqual(fieldErrors, {});
  assert.equal(accountType, "ewallet");
  assert.ok(LIVE_CHECK_BEFORE.includes(accountType), "ewallet already works before the SQL patch");
});

test("Tabungan: savings validates and is labelled Tabungan", async () => {
  const { getAccountTypeMeta } = await import("../lib/accounts.ts");
  assert.deepEqual(validateAccountInput(validInput("savings")).fieldErrors, {});
  assert.equal(getAccountTypeMeta("savings").label, "Tabungan");
  assert.equal(getAccountTypeMeta("savings").accent, "emerald");
});

test("legacy values stay readable but are not offered or writable", async () => {
  const { getAccountTypeMeta } = await import("../lib/accounts.ts");
  assert.equal(getAccountTypeMeta("ewallet").label, "E-wallet");
  assert.equal(getAccountTypeMeta("e_wallet").label, "E-wallet");
  assert.equal(getAccountTypeMeta("other").label, "Lainnya");
  assert.equal(getAccountTypeMeta("mystery").label, "mystery");
  assert.equal(isAccountTypeValue("other"), false);
  assert.ok(validateAccountInput(validInput("other")).fieldErrors.account_type);
});

test("unknown or tampered types are rejected by validation", () => {
  for (const value of ["", "wallet", "SAVINGS", "e-wallet", "loan"]) {
    assert.ok(validateAccountInput(validInput(value)).fieldErrors.account_type, value);
  }
});

test("opening balance validation is unchanged: 0 and positive pass, negative and NaN fail", () => {
  assert.deepEqual(validateAccountInput({ ...validInput("cash"), initial_balance: 0 }).fieldErrors, {});
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(validateAccountInput({ ...validInput("cash"), initial_balance: bad }).fieldErrors.initial_balance);
  }
});

test("account actions write the canonical type from validation on create and edit", () => {
  const actions = read("app/(app)/accounts/actions.ts");
  assert.equal((actions.match(/validateAccountInput\(input\)/g) ?? []).length, 2);
  assert.equal((actions.match(/account_type: accountType,/g) ?? []).length, 2);
  assert.doesNotMatch(actions, /account_type: input\.account_type/);
});

test("the dashboard glyph map covers every canonical type", async () => {
  const card = read("components/dashboard/dashboard-account-card.tsx");
  for (const value of ACCOUNT_TYPE_VALUES) {
    assert.match(card, new RegExp(`\\b${value}: "`), `no glyph for ${value}`);
  }
});

// --- opening balance input -------------------------------------------------

test("typing digits shows formatted Rupiah inside the field", () => {
  assert.equal(formatOpeningBalanceInput("123133"), "Rp 123.133");
  assert.equal(formatOpeningBalanceInput("1"), "Rp 1");
  assert.equal(formatOpeningBalanceInput("1234567890"), "Rp 1.234.567.890");
  assert.equal(formatOpeningBalanceInput("0"), "Rp 0");
  assert.equal(formatOpeningBalanceInput("000123"), "Rp 123");
});

test("re-formatting while editing keeps the digits the user typed", () => {
  // Each step is what the browser reports after one keystroke on the
  // formatted value, then the formatter output becomes the next value.
  let shown = "";
  for (const key of "123133") shown = formatOpeningBalanceInput(shown + key);
  assert.equal(shown, "Rp 123.133");
  // Backspace at the end removes one digit.
  shown = formatOpeningBalanceInput(shown.slice(0, -1));
  assert.equal(shown, "Rp 12.313");
  // A digit typed in the middle stays in place.
  shown = formatOpeningBalanceInput("Rp 12.9313");
  assert.equal(shown, "Rp 129.313");
  // Pasting a formatted value or letters keeps only the digits.
  assert.equal(formatOpeningBalanceInput("Rp 5.000.000"), "Rp 5.000.000");
  assert.equal(formatOpeningBalanceInput("abc"), "");
});

test("clearing the field leaves it empty, never Rp NaN", () => {
  assert.equal(formatOpeningBalanceInput("Rp "), "");
  assert.equal(formatOpeningBalanceInput("Rp"), "");
  assert.equal(formatOpeningBalanceInput(""), "");
  assert.equal(parseOpeningBalanceInput(""), 0);
  assert.equal(parseOpeningBalanceInput("   "), 0);
});

test("submission sends the exact numeric value", () => {
  for (const amount of [0, 1, 999, 1000, 123133, 5000000, 987654321012, Number.MAX_SAFE_INTEGER]) {
    const shown = formatOpeningBalanceInput(String(amount));
    assert.equal(parseOpeningBalanceInput(shown), amount, shown);
  }
});

test("invalid or unsafe text is rejected instead of guessed", () => {
  for (const text of ["Rp 12,5", "Rp 1.23", "-100", "Rp -1", "abc", "Rp 9.007.199.254.740.992"]) {
    assert.equal(parseOpeningBalanceInput(text), null, text);
  }
});

test("an existing balance opens formatted; a legacy decimal is not rounded", () => {
  assert.equal(openingBalanceInputFromValue(250000), "Rp 250.000");
  assert.equal(openingBalanceInputFromValue(0), "Rp 0");
  const legacy = openingBalanceInputFromValue(12.5);
  assert.equal(legacy, "12.5");
  assert.equal(parseOpeningBalanceInput(legacy), null, "the user must retype it");
});

test("the form uses the formatter, parses on submit, and has no separate preview", () => {
  const form = read("components/finance/account-form.tsx");
  assert.match(form, /setBalanceInput\(formatOpeningBalanceInput\(e\.target\.value\)\)/);
  assert.match(form, /const balance = parseOpeningBalanceInput\(balanceInput\);/);
  assert.match(form, /openingBalanceInputFromValue\(initialValues\.initial_balance\)/);
  assert.doesNotMatch(form, /balancePreview|idrPreview|parseIdrInput/);
});
