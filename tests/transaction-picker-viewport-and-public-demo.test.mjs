import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("category and duplicate screens mount at document root, not nested in a page container", () => {
  const screen = read("components/transactions/transaction-selection-screens.tsx");
  const form = read("components/finance/transaction-form.tsx");
  const header = read("components/layout/app-header.tsx");

  assert.match(screen, /import \{ createPortal \} from "react-dom"/);
  assert.match(screen, /return createPortal\([\s\S]*?document\.body/);
  assert.match(screen, /className="fixed inset-0 z-\[70\]/);
  assert.match(screen, /pt-\[calc\(0\.5rem\+env\(safe-area-inset-top\)\)\]/);
  assert.match(screen, /<AppHeader[\s\S]*?title=\{title\}[\s\S]*?titleAction=/);
  assert.match(header, /className=\{cn\(/);
  assert.match(screen, /<Icon name="arrow_back" size=\{20\} \/>/);
  assert.match(form, /<TransactionCategoryScreen/);
  assert.match(form, /<TransactionDuplicateScreen/);
  assert.match(form, /inert=\{activeScreen !== null\}/);
});

test("desktop centered picker retains the exact scrollbar gutter of Tambah transaksi", () => {
  const css = read("app/globals.css");
  const form = read("components/finance/transaction-form.tsx");
  const picker = read("components/transactions/transaction-selection-screens.tsx");

  // When the picker hides the body scrollbar, the root keeps the same
  // 15px classic scrollbar gutter; otherwise the 768px page shifts ~7px.
  assert.match(css, /html\s*\{\s*scrollbar-gutter:\s*stable;\s*\}/);
  assert.match(form, /document\.body\.style\.overflow = "hidden"/);
  assert.match(form, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(picker, /return createPortal\([\s\S]*?document\.body/);
  assert.match(picker, /className="fixed inset-0 z-\[70\]/);
  assert.doesNotMatch(picker, /(?:ml-|translate-x-|left-\[|right-\[)\d/);
});

test("preview-only demo never unlocks authenticated account routes", () => {
  const proxy = read("proxy.ts");
  const helper = read("lib/auth/public-testing-demo.ts");
  const appLayout = read("app/(app)/layout.tsx");
  const demo = read("app/testing/page.tsx");
  const tx = read("app/testing/transactions/new/page.tsx");
  const account = read("app/testing/accounts/edit/page.tsx");
  const budget = read("app/testing/budget/edit/page.tsx");
  const fixture = read("lib/testing/demo-budgetku-data.ts");

  assert.match(proxy, /isDemoRoute && isPublicTestingDemoAllowed\(\)/);
  assert.match(proxy, /return NextResponse\.next\(\)/);
  assert.match(helper, /process\.env\.VERCEL_ENV === "preview"/);
  assert.doesNotMatch(helper, /createClient|SUPABASE_SERVICE_ROLE/);
  assert.match(appLayout, /AuthGuard/);
  assert.match(appLayout, /redirect\("\/auth\/login"\)/);

  for (const page of [demo, tx, account, budget]) {
    assert.match(page, /if \(!isPublicTestingDemoAllowed\(\)\) notFound\(\)/);
  }
  assert.match(tx, /async function doNotSaveInDemo/);
  assert.match(tx, /Mode demo hanya untuk memeriksa UI\. Data tidak disimpan/);
  assert.match(account, /action=\{demoAccountEdit\}/);
  assert.match(budget, /action=\{demoBudgetEdit\}/);
  assert.match(account, /computeTransactionEffects\(DEMO_TRANSACTIONS\)/);
  assert.match(demo, /href="\/testing\/accounts\/edit"/);
  assert.match(demo, /href="\/testing\/budget\/edit"/);
  assert.match(fixture, /export const DEMO_ACCOUNTS/);
  assert.match(fixture, /export const DEMO_TRANSACTIONS/);
  assert.doesNotMatch([demo, tx, account, budget, fixture].join("\n"), /\.from\(|\.insert\(|\.update\(|\.delete\(|createClient\(/);
});
