import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("duplicate picker uses the same responsive headline as other page headers", () => {
  const picker = read("components/transactions/transaction-selection-screens.tsx");
  const header = read("components/layout/app-header.tsx");
  assert.match(header, /<h1 className="min-w-0 text-headline-lg text-on-surface">/);
  assert.match(picker, /<h2 className="min-w-0 text-headline-lg text-on-surface">\{title\}<\/h2>/);
  assert.match(picker, /title="Duplikat transaksi"/);
  assert.match(picker, /title="Pilih kategori"/);
  assert.match(picker, /aria-label=\{title\}/);
});

test("Transactions always provides the Gmail sync control, even with zero pending drafts", () => {
  const page = read("app/(app)/transactions/page.tsx");
  const bar = read("components/transactions/gmail-sync-bar.tsx");
  const action = read("app/(app)/settings/gmail/actions.ts");

  assert.match(page, /\.from\("email_connections"\)[\s\S]*?\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.select\("email_address, status, last_synced_at"\)/);
  assert.match(page, /const gmailSyncBar =/);
  assert.match(page, /connected=\{gmailConnection\?\.status === "active"\}/);
  assert.match(page, /\{gmailSyncBar\}[\s\S]*?\{gmailQueue\}[\s\S]*?<LedgerEmptyState/);
  assert.match(page, /\{gmailSyncBar\}[\s\S]*?\{gmailQueue\}[\s\S]*?<TransactionSearch \/>/);
  assert.match(bar, /import \{ syncGmail \} from "@\/app\/\(app\)\/settings\/gmail\/actions"/);
  assert.match(bar, /disabled=\{isSyncing\}/);
  assert.match(bar, /"Menyinkronkan\.\.\." : "Sync sekarang"/);
  assert.match(bar, /router\.refresh\(\)/);
  assert.match(bar, /<Link href="\/settings\/gmail">Hubungkan Gmail<\/Link>/);
  assert.match(bar, /"Sinkronisasi selesai\. Periksa draft Gmail sebelum mencatat\."/);
  assert.match(action, /export async function syncGmail\(\): Promise<ActionResult>/);
  assert.match(action, /if \(!user\)/);
  assert.match(action, /\.eq\("user_id", user\.id\)/);
  assert.match(action, /revalidatePath\("\/transactions"\);\s*revalidatePath\("\/transactions\/gmail"\);/);
  assert.doesNotMatch(bar, /importDraft\(|\.from\("transactions"\)\.insert/);
});
