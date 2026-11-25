import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareLedgerRows } from "../lib/transactions/ledger-order.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const tx = (id, day, created_at) => ({ id, transaction_at: day, created_at });
const adjustment = (id, timestamp) => ({ id, transaction_at: timestamp });

test("a later manual transaction appears above an earlier balance adjustment", () => {
  const rows = [
    tx("before", "2026-11-25", "2026-11-25T01:00:00Z"),
    tx("after", "2026-11-25", "2026-11-25T09:00:00Z"),
    adjustment("adjustment", "2026-11-25T05:00:00Z"),
  ];
  assert.deepEqual(rows.sort(compareLedgerRows).map(r => r.id), ["after", "adjustment", "before"]);
});

test("transaction date still wins across different days even for backdated entries", () => {
  const rows = [
    tx("backdated", "2026-11-24", "2026-11-26T07:00:00Z"),
    adjustment("adjustment", "2026-11-25T05:00:00Z"),
    tx("next-day", "2026-11-26", "2026-11-26T01:00:00Z"),
  ];
  assert.deepEqual(rows.sort(compareLedgerRows).map(r => r.id), ["next-day", "adjustment", "backdated"]);
});

test("equal recording times have a deterministic order", () => {
  const rows = [tx("a", "2026-11-25", "2026-11-25T05:00:00Z"), adjustment("b", "2026-11-25T05:00:00Z")];
  assert.deepEqual(rows.sort(compareLedgerRows).map(r => r.id), ["b", "a"]);
});

test("ledger uses the tested comparator", () => {
  assert.match(read("app/(app)/transactions/page.tsx"), /\.sort\(compareLedgerRows\)/);
});

test("reminder form retains controlled state and submits explicit on or off", () => {
  const form = read("components/settings/preferences-form.tsx");
  assert.match(form, /useState\(dailyReminderEnabled\)/);
  assert.match(form, /checked=\{reminderEnabled\}/);
  assert.match(form, /onCheckedChange=/);
  assert.match(form, /name="dailyReminderEnabled" value=\{reminderEnabled \? "on" : "off"\}/);
  assert.doesNotMatch(form, /defaultChecked=/);
  assert.match(form, /event\.preventDefault\(\)/);
  assert.match(form, /startTransition\(\(\) => action\(data\)\)/);
  const action = read("app/(app)/settings/actions.ts");
  assert.match(action, /reminderValue !== "on" && reminderValue !== "off"/);
  assert.match(action, /\.select\("daily_reminder_enabled"\)\.single\(\)/);
  assert.match(action, /saved\?\.daily_reminder_enabled !== reminderEnabled/);
});


test("only the dedicated staging preview can save a reminder without push configuration", () => {
  const page = read("app/(app)/settings/page.tsx");
  const action = read("app/(app)/settings/actions.ts");
  const form = read("components/settings/preferences-form.tsx");
  const gate = /process\.env\.VERCEL_ENV === "preview" && isStagingEmailLoginAllowed\(\)/;
  assert.match(page, gate);
  assert.match(action, gate);
  assert.match(action, /if \(reminderEnabled && !reminderConfigured && !stagingPreferenceTest\)/);
  assert.match(form, /!reminderConfigured && !dailyReminderEnabled && !stagingPreferenceTest/);
  assert.match(action, /pengiriman notifikasi belum aktif/);
  assert.match(form, /notifikasi belum dikirim/);
});
