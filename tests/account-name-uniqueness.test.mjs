import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeAccountName, accountNameChanged } from "../lib/account-name.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("account names compare case-insensitively across whitespace", () => {
  assert.equal(normalizeAccountName(" BCA  "), "bca");
  assert.equal(normalizeAccountName("bca"), "bca");
  assert.equal(normalizeAccountName(" BCA   Utama"), normalizeAccountName("bca utama"));
  assert.equal(normalizeAccountName(" BCA\tUtama\n"), "bca utama");
  assert.notEqual(normalizeAccountName("BCA"), normalizeAccountName("GoPay"));
});

test("legacy duplicate accounts can edit non-name fields", () => {
  assert.equal(accountNameChanged("BCA", " bca "), false);
  assert.equal(accountNameChanged(" BCA   Utama ", "bca utama"), false);
  assert.equal(accountNameChanged("BCA", "GoPay"), true);
  const source = read("app/(app)/accounts/actions.ts");
  assert.match(source, /accountNameChanged\(currentAccount\.name, input\.name\)/);
  assert.match(source, /\.eq\("id", id\)/);
  assert.match(source, /\.eq\("user_id", user\.id\)/);
});

test("account server checks duplicate names in both create and edit", () => {
  const src=read("app/(app)/accounts/actions.ts");
  assert.match(src,/isAccountNameTaken\(supabase, user\.id, input\.name\)/);
  assert.match(src,/isAccountNameTaken\(supabase, user\.id, input\.name, id\)/);
  assert.match(src,/normalizeAccountName\(row\.name\) === normalized/);
  assert.match(src,/fetchAllPages/);
  assert.match(src,/fieldErrors: \{ name: DUPLICATE_NAME_MESSAGE \}/);
  assert.match(src,/error\?\.code === "23505"/);
});

test("placeholder uses the simple BCA example", () => {
  const src=read("components/finance/account-form.tsx");
  assert.match(src,/placeholder="Misal: BCA"/);
  assert.doesNotMatch(src,/BCA utama/);
});

test("staged database guard ignores account type and allows old duplicates to remain", () => {
  const src=read("docs/sql/2026-11-account-name-uniqueness.sql");
  assert.match(src,/CREATE TRIGGER accounts_reject_duplicate_name/);
  assert.match(src,/pg_advisory_xact_lock/);
  assert.match(src,/NEW\.user_id = OLD\.user_id/);
  assert.match(src,/a\.user_id = NEW\.user_id/);
  assert.doesNotMatch(src,/a\.account_type = NEW\.account_type/);
  assert.doesNotMatch(src,/DELETE FROM public\.accounts|UPDATE public\.accounts SET name/i);
  assert.match(src,/ERRCODE = '23505'/);
});
