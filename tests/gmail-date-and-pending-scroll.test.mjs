import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("iOS native date inputs cannot exceed the shared form or their field rows", () => {
  const form = read("components/finance/transaction-form.tsx");
  const row = read("components/transactions/transaction-field-row.tsx");

  assert.match(form, /<form onSubmit=\{handleSubmit\} className="flex w-full min-w-0 max-w-full/);
  assert.match(row, /"flex min-w-0 max-w-full flex-col gap-2 p-lg"/);
  assert.match(form, /min-w-0 max-w-full flex-col divide-y divide-border/);

  for (const id of ["dateId", "endDateId"]) {
    const start = form.indexOf(`id={${id}}`);
    assert.ok(start >= 0, `Date control ${id} must exist`);
    const tag = form.slice(start, form.indexOf("/>", start));
    assert.match(tag, /type="date"/);
    assert.match(tag, /className="h-11 w-full min-w-0 max-w-full"/);
  }
});

test("Transaksi shows about three Gmail draft rows, scrolls the rest and keeps a visible full-list link", () => {
  const queue = read("components/transactions/gmail-pending-queue.tsx");
  const page = read("app/(app)/transactions/page.tsx");
  const inbox = read("app/(app)/transactions/gmail/page.tsx");

  assert.match(queue, /const hasScroll = showAllLink && total > 3/);
  assert.match(queue, /hasScroll &&\s*"max-h-\[24rem\] min-w-0 overflow-y-auto overscroll-contain/);
  assert.match(queue, /hasScroll && "min-h-32"/);
  assert.match(queue, /tabIndex=\{hasScroll \? 0 : undefined\}/);
  assert.match(queue, /data-pull-refresh-exclude=\{hasScroll \? true : undefined\}/);
  assert.match(queue, /Geser daftar untuk melihat/);
  assert.match(queue, /Lihat semua \{total\} draft Gmail/);
  assert.ok(queue.indexOf("Lihat semua {total} draft Gmail") > queue.indexOf("</ul>"),
    "Full-list action must remain visible below the inner scroll viewport");
  assert.match(queue, /"arrow_forward"/);

  assert.match(page, /\.from\("email_imports"\)/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.eq\("status", "pending"\)/);
  assert.match(page, /\.limit\(100\)/);
  assert.match(inbox, /\.limit\(100\)/);
  assert.match(inbox, /showAllLink=\{false\}/);
  assert.doesNotMatch(queue, /\.insert\(\)|importDraft\(/);
});

test("nested Gmail scrolling does not fire pull-to-refresh for the whole page", () => {
  const frame = read("components/layout/app-frame.tsx");
  const queue = read("components/transactions/gmail-pending-queue.tsx");
  assert.match(frame, /\[data-pull-refresh-exclude\]/);
  assert.match(queue, /data-pull-refresh-exclude/);
  assert.match(queue, /overscroll-contain/);
});

test("Gmail review retains the full Catat form, safe approval and responsive controls", () => {
  const review = read("components/finance/gmail-import-review.tsx");
  const actions = read("app/(app)/settings/gmail/actions.ts");
  assert.match(review, /<TransactionForm/);
  assert.match(review, /allowRecurring=\{false\}/);
  assert.match(review, /submitText="Terima dan catat transaksi"/);
  assert.match(actions, /importRow\.status !== "pending"/);
  assert.match(actions, /isValidTransactionIdrAmount\(input\.amount\)/);
});
