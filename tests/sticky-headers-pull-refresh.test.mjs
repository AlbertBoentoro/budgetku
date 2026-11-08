import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  PULL_REFRESH_THRESHOLD,
  getPullRefreshDistance,
  isPullRefreshReady,
} from "../lib/pull-refresh.ts";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("downward pull at page top reaches a deliberate refresh threshold", () => {
  assert.equal(PULL_REFRESH_THRESHOLD, 64);
  assert.equal(getPullRefreshDistance(100, 150, 100, 230, 0), 52);
  assert.equal(getPullRefreshDistance(100, 150, 100, 250, 0), 65);
  assert.equal(isPullRefreshReady(52), false);
  assert.equal(isPullRefreshReady(65), true);
  assert.equal(getPullRefreshDistance(0, 0, 0, 999, 0), 112);
});

test("never refresh when scrolled, swiping up, or navigating horizontally", () => {
  assert.equal(getPullRefreshDistance(50, 50, 50, 250, 10), 0);
  assert.equal(getPullRefreshDistance(50, 50, 50, 40, 0), 0);
  assert.equal(getPullRefreshDistance(50, 50, 170, 90, 0), 0);
  assert.equal(getPullRefreshDistance(50, 50, 50, 50, 0), 0);
  assert.equal(getPullRefreshDistance(0, 0, NaN, 90, 0), 0);
  assert.equal(isPullRefreshReady(63), false);
});

test("shared shell wires pull gesture to router.refresh without hard reload", () => {
  const frame = source("components/layout/app-frame.tsx");
  for (const handler of ["onTouchStart", "onTouchMove", "onTouchEnd", "onTouchCancel"]) {
    assert.ok(frame.includes(`${handler}=`), `${handler} must be handled`);
  }
  assert.match(frame, /onPullEnd\(\)/);
  assert.match(frame, /startRefresh\(\(\) => router\.refresh\(\)\)/);
  assert.match(frame, /window\.scrollY/);
  assert.match(frame, /document\.scrollingElement\?\.scrollTop/);
  assert.match(frame, /event\.touches\.length !== 1/);
  assert.match(frame, /input, textarea, select, button/);
  assert.match(frame, /\[role='dialog'\]/);
  assert.match(frame, /\[role='menu'\]/);
  assert.match(frame, /Tarik untuk refresh/);
  assert.match(frame, /Lepas untuk refresh/);
  assert.match(frame, /Memuat ulang data/);
  assert.match(frame, /aria-live="polite"/);
  assert.doesNotMatch(frame, /location\.reload\(/);
  assert.match(source("app/globals.css"), /overscroll-behavior-y: contain/);
});

test("detail and settings headers remain sticky above page contents with safe-area support", () => {
  const header = source("components/layout/app-header.tsx");
  assert.match(header, /titleAction &&/);
  assert.match(header, /sticky top-\[env\(safe-area-inset-top\)\] z-30/);
  assert.match(header, /bg-surface py-2/);
  assert.match(header, /border-b border-outline-variant/);
  const detailScreens = [
    "app/(app)/transactions/new/page.tsx",
    "app/(app)/transactions/[id]/edit/page.tsx",
    "app/(app)/transactions/recover/page.tsx",
    "app/(app)/accounts/new/page.tsx",
    "app/(app)/accounts/[id]/edit/page.tsx",
    "app/(app)/budget/new/page.tsx",
    "app/(app)/budget/items/new/page.tsx",
    "app/(app)/budget/items/[id]/edit/page.tsx",
    "app/(app)/goals/new/page.tsx",
    "app/(app)/goals/[id]/page.tsx",
    "app/(app)/goals/[id]/edit/page.tsx",
    "app/(app)/goals/[id]/contribute/page.tsx",
    "app/(app)/recurring/[id]/edit/page.tsx",
    "app/(app)/settings/page.tsx",
    "app/(app)/settings/gmail/page.tsx",
    "app/(app)/reports/page.tsx",
  ];
  for (const page of detailScreens) {
    const content = source(page);
    assert.match(content, /<AppHeader/, `${page} needs shared header`);
    assert.match(content, /<AppBackLink/, `${page} needs back button`);
    assert.match(content, /titleAction=\{/, `${page} needs sticky-mode trigger`);
  }
});

test("the net balance remains sen-safe and is raised around two points on mobile", () => {
  const component = source("components/dashboard/net-balance-card.tsx");
  assert.match(component, /maximumFractionDigits: 2/);
  assert.match(component, /text-\[clamp\(1\.25rem,5vw,1\.75rem\)\]/);
  assert.match(component, /text-\[clamp\(1\.375rem,6\.1vw,2rem\)\]/);
  assert.match(component, /text-\[clamp\(1\.5rem,7\.2vw,2\.125rem\)\]/);
  assert.doesNotMatch(component, /absolute right-2 top-2/);
  assert.match(component, /value=\{balance\}/);
});
