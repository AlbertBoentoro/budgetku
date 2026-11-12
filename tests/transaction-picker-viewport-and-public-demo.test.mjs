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

test("preview-only demo is gated, synthetic and cannot write to staging or production", () => {
  const proxy = read("proxy.ts");
  const helper = read("lib/auth/staging-email-login.ts");
  const demo = read("app/testing/page.tsx");
  const formDemo = read("app/testing/transactions/new/page.tsx");
  const fixture = read("lib/testing/demo-budgetku-data.ts");

  assert.match(proxy, /isDemoRoute && isStagingEmailLoginAllowed\(\)/);
  assert.match(proxy, /return NextResponse\.next\(\)/);
  assert.match(helper, /process\.env\.VERCEL_ENV !== "production"/);
  assert.match(helper, /process\.env\.NEXT_PUBLIC_SUPABASE_URL === STAGING_SUPABASE_URL/);
  assert.match(demo, /if \(!isStagingEmailLoginAllowed\(\)\) notFound\(\)/);
  assert.match(formDemo, /if \(!isStagingEmailLoginAllowed\(\)\) notFound\(\)/);
  assert.match(formDemo, /async function doNotSaveInDemo/);
  assert.match(formDemo, /Mode demo hanya untuk memeriksa UI\. Data tidak disimpan/);
  assert.match(formDemo, /recentTransactions=\{DEMO_TRANSACTIONS\}/);
  assert.match(formDemo, /accounts=\{DEMO_ACCOUNTS\}/);
  assert.match(formDemo, /<TransactionForm/);
  assert.match(fixture, /export const DEMO_TRANSACTIONS/);
  assert.match(fixture, /export const DEMO_ACCOUNTS/);
  assert.doesNotMatch(formDemo + demo + fixture, /\.from\(|\.insert\(|\.update\(|\.delete\(|createClient\(/);
});
