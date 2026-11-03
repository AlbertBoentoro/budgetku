// End-to-end browser test against a LOCAL Next.js server and a dedicated
// disposable Supabase STAGING project. Never target production resources.
// GitHub Actions secrets stay within the runner and are never printed.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const PRODUCTION_REF = "zvmqrrttdrqkyrdzyxlf";
const APPROVED_STAGING_REF = "omnzuolrlwczvnxrvenw";
const target = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const stageRef = process.env.STAGING_PROJECT_REF;
if (!url || !key || !secret || !stageRef || process.env.BUDGETKU_STAGING_E2E !== "true") {
  throw new Error("Required staging-only configuration is missing. No tests executed.");
}
const host = new URL(url).hostname.toLowerCase();
if (!host.endsWith(".supabase.co") || !host.startsWith(stageRef + ".") ||
    stageRef !== APPROVED_STAGING_REF || stageRef === PRODUCTION_REF ||
    url.includes(PRODUCTION_REF) ||
    !["http://127.0.0.1:3000", "http://localhost:3000"].includes(target)) {
  throw new Error("Staging safety guard: refused possible production environment.");
}
const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let userId;
let browser;
let globalSystemCategoryId;
const email = "budgetku-e2e-" + randomBytes(8).toString("hex") + "@example.test";
const password = randomBytes(25).toString("base64url");

function must(result, action) {
  if (result.error) throw new Error(action + ": " + result.error.message);
  return result.data;
}

async function eventually(read, predicate, description) {
  for (let i = 0; i < 16; i++) {
    const value = await read();
    if (predicate(value)) return value;
    await delay(600);
  }
  throw new Error("Timeout checking " + description);
}

async function buildBrowserCookies() {
  const cookieJar = new Map();
  const ssr = createServerClient(url, key, {
    cookies: {
      getAll() { return [...cookieJar.entries()].map(([name, value]) => ({ name, value })); },
      setAll(updated) {
        for (const { name, value } of updated) cookieJar.set(name, value);
      },
    },
  });
  must(await ssr.auth.signInWithPassword({ email, password }), "sign in synthetic staging account");
  assert.ok(cookieJar.size > 0, "Supabase SSR should create session cookies");
  return [...cookieJar.entries()].map(([name, value]) => ({
    url: target, name, value, httpOnly: false, secure: false, sameSite: "Lax",
  }));
}

try {
  const created = must(await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  }), "create synthetic staging user");
  assert.ok(created.user?.id);
  userId = created.user.id;

  const account = must(await admin.from("accounts")
    .insert({
      user_id: userId, name: "E2E Test Cash", account_type: "cash",
      initial_balance: 1000000, currency: "IDR", include_in_total: true,
    }).select("id").single(), "seed synthetic cash account");
  const category = must(await admin.from("categories")
    .insert({
      user_id: userId, name: "E2E Test Expense",
      category_type: "expense", is_system: false, is_archived: false,
    }).select("id").single(), "seed synthetic expense category");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: target, viewport: { width: 390, height: 844 } });
  await context.addCookies(await buildBrowserCookies());
  const page = await context.newPage();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL((next) => next.pathname === "/dashboard", { timeout: 25000 });
  console.log("PASS: synthetic account is authenticated and dashboard is accessible");

  await page.goto("/transactions/new", { waitUntil: "domcontentloaded" });
  const amount = page.getByLabel("Nominal Pengeluaran");
  await amount.waitFor({ state: "visible", timeout: 25000 });
  await amount.fill("25000");
  await page.getByLabel("Kategori").selectOption(category.id);
  await page.locator('input[type="date"]').first().fill("2026-01-31");
  await page.getByRole("checkbox", { name: "Jadikan transaksi berulang" }).check();
  await page.getByLabel("Frekuensi").selectOption("monthly");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.waitForURL((next) => next.pathname === "/transactions", { timeout: 25000 });
  await eventually(async () => must(
    await admin.from("transactions")
      .select("id,amount,account_id,category_id,transaction_type")
      .eq("user_id", userId),
    "read synthetic staging transactions",
  ), (rows) => rows.length === 1, "new test transaction");

  const transactions = must(await admin.from("transactions")
    .select("amount,transaction_type,account_id,category_id")
    .eq("user_id", userId), "verify synthetic ledger");
  assert.equal(transactions.length, 1);
  assert.equal(Number(transactions[0].amount), 25000);
  assert.equal(transactions[0].transaction_type, "expense");
  assert.equal(transactions[0].account_id, account.id);
  assert.equal(transactions[0].category_id, category.id);
  assert.equal(1000000 - Number(transactions[0].amount), 975000);

  const recurringTemplates = must(await admin.from("recurring_transactions")
    .select("id,amount,frequency,start_date,next_due_date,is_active")
    .eq("user_id",userId), "verify single recurring template");
  assert.equal(recurringTemplates.length,1,"Initial expense should create one schedule");
  assert.equal(Number(recurringTemplates[0].amount),25000);
  assert.equal(recurringTemplates[0].frequency,"monthly");
  assert.equal(recurringTemplates[0].start_date,"2026-01-31");
  assert.equal(recurringTemplates[0].next_due_date,"2026-02-28");
  const initialTransactions = must(await admin.from("transactions")
    .select("id,source,source_reference").eq("user_id",userId),"verify idempotent initial source");
  assert.equal(initialTransactions.length,1);
  assert.equal(initialTransactions[0].source,"manual");
  assert.match(initialTransactions[0].source_reference,/^initial-recurring:[0-9a-f-]{36}$/);
  console.log("PASS: Playwright recurring form saved one ledger entry and one correct month-end schedule");
  console.log("PASS: browser expense+recurring schedule recorded correctly in staging");

  // Exercise the actual authenticated staging RPC after the browser's
  // successful initial Submit. This simulates a network retry/double-submit:
  // both attempts carry the same stable request token and MUST return the
  // original ledger ID, never add another transaction or schedule.
  const userClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  must(await userClient.auth.signInWithPassword({ email, password }),
    "authenticate synthetic caller for retry checks");
  const requestKey = initialTransactions[0].source_reference.slice("initial-recurring:".length);
  const retryPayload = {
    p_client_key: requestKey,
    p_transaction_type: "expense",
    p_amount: 25000,
    p_account_id: account.id,
    p_destination_account_id: null,
    p_category_id: category.id,
    p_transaction_date: "2026-01-31",
    p_description: null,
    p_merchant: null,
    p_recurring_name: "E2E Test Expense",
    p_frequency: "monthly",
    p_end_date: null,
  };
  const retryResponses = await Promise.all([
    userClient.rpc("create_transaction_with_recurring", retryPayload),
    userClient.rpc("create_transaction_with_recurring", retryPayload),
  ]);
  for (const result of retryResponses) {
    assert.equal(must(result, "repeat synthetic recurring save"), initialTransactions[0].id);
  }

  // Previously, a retry changing ONLY the recurrence was silently accepted
  // even though the modified schedule was not saved. Reject this ambiguity.
  for (const changed of [
    { p_frequency: "weekly" },
    { p_end_date: "2026-06-30" },
    { p_recurring_name: "E2E Changed Schedule" },
    { p_amount: 30000 },
  ]) {
    const result = await userClient.rpc("create_transaction_with_recurring", {
      ...retryPayload, ...changed,
    });
    assert.equal(result.error?.code, "P0001",
      "Changed retry must be rejected without affecting synthetic ledger");
  }

  const afterRetries = must(await admin.from("transactions")
    .select("id,amount").eq("user_id",userId),"verify no repeated ledger entries");
  const schedulesAfterRetries = must(await admin.from("recurring_transactions")
    .select("id,amount,name,frequency,end_date").eq("user_id",userId),
    "verify unchanged synthetic recurring schedule");
  assert.equal(afterRetries.length,1);
  assert.equal(afterRetries[0].id,initialTransactions[0].id);
  assert.equal(Number(afterRetries[0].amount),25000);
  assert.equal(schedulesAfterRetries.length,1);
  assert.equal(schedulesAfterRetries[0].name,"E2E Test Expense");
  assert.equal(schedulesAfterRetries[0].frequency,"monthly");
  assert.equal(schedulesAfterRetries[0].end_date,null);
  console.log("PASS: authenticated parallel retries return original ID; mismatched recurring retries are rejected without duplicates");

  // Test backup API through browser's authenticated HTTP context. This
  // creates test-user-only storage objects on staging, never production.
  const backupResponse = await context.request.post("/api/settings/backup");
  assert.equal(backupResponse.status(), 200, "manual staging backup should succeed");
  const inspection = await context.request.get("/api/settings/backup/inspect");
  assert.equal(inspection.status(), 200);
  const check = await inspection.json();
  assert.equal(check.valid, true);
  assert.equal(check.counts.transactions, 1);
  assert.equal(check.counts.recurringTransactions, 1);
  console.log("PASS: authenticated backup can be created and inspected on staging");

  const history = await context.request.get("/api/settings/backup/history");
  assert.equal(history.status(), 200);
  const archives = (await history.json()).snapshots;
  assert.ok(archives.length >= 1);
  const download = await context.request.get("/api/settings/backup?snapshot=" +
    encodeURIComponent(archives[0].name));
  assert.equal(download.status(), 200);
  console.log("PASS: versioned snapshot can be downloaded by synthetic staging user");
  // Read-only preview from a verified immutable snapshot. Never call an
  // apply/restore endpoint or modify any existing financial record.
  const previewResponse = await context.request.post("/api/settings/restore/preview", {
    data: { snapshot: archives[0].name },
  });
  assert.equal(previewResponse.status(),200,"read-only backup preview should succeed");
  const preview = await previewResponse.json();
  assert.equal(preview.previewOnly,true);
  assert.equal(preview.restoreExecutionEnabled,false);
  assert.equal(preview.eligibleForAtomicRestore,true);
  assert.equal(preview.tables.transactions.current,1);
  assert.equal(preview.tables.transactions.wouldRemove,0);
  assert.equal(preview.tables.recurringTransactions.current,1);
  assert.equal(preview.tables.recurringTransactions.wouldRemove,0);
  assert.match(preview.backupSha256,/^[a-f0-9]{64}$/);

  const unsafeSnapshot = await context.request.post("/api/settings/restore/preview", {
    data: { snapshot: "../latest.json" },
  });
  assert.equal(unsafeSnapshot.status(),400,"path traversal must be denied");
  const offsitePreview = await context.request.post("/api/settings/restore/preview", {
    headers: { Origin: "https://untrusted.example" },
    data: { snapshot: archives[0].name },
  });
  assert.equal(offsitePreview.status(),403,"cross-origin request must be denied");
  const anonymous = await browser.newContext();
  const unauthenticatedPreview = await anonymous.request.post(target + "/api/settings/restore/preview", {
    data: { snapshot: archives[0].name },
    maxRedirects: 0,
  });
  assert.ok([307, 401].includes(unauthenticatedPreview.status()),
    "anonymous caller must be denied or redirected before accessing snapshot data");
  if (unauthenticatedPreview.status() === 307) {
    assert.equal(new URL(unauthenticatedPreview.headers().location, target).pathname,
      "/auth/login", "anonymous redirect must lead to login");
  }
  await anonymous.close();

  // Exercise the real Settings UI, not only the API. No Apply/Restore control
  // is intentionally provided at this stage.
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Versi cadangan").waitFor({ state: "visible", timeout: 25000 });
  // Regression: manual backup must update the independent history dropdown
  // immediately and auto-select the newest verified snapshot, no navigation.
  const picker = page.getByLabel("Versi cadangan");
  const previouslySelected = await eventually(
    () => picker.inputValue(),
    value => value === archives[0].name,
    "existing backup list loaded before creating the next snapshot",
  );
  assert.equal(previouslySelected, archives[0].name);
  await page.getByRole("button", { name: "Cadangkan sekarang" }).click();
  await page.getByText("Cadangan cloud berhasil dibuat.").waitFor({
    state: "visible", timeout: 25000,
  });
  const refreshedSelection = await eventually(
    () => picker.inputValue(),
    value => value !== previouslySelected && value.endsWith(".json"),
    "newly created backup becomes selected without page reload",
  );
  const refreshedHistory = await context.request.get("/api/settings/backup/history");
  assert.equal(refreshedHistory.status(), 200);
  const latestFilename = (await refreshedHistory.json()).snapshots[0].name;
  assert.equal(refreshedSelection, latestFilename,
    "Settings picker should select newly created snapshot, not stale previous backup");
  assert.match(await picker.locator("option:checked").textContent(), /Terbaru/);
  console.log("PASS: manual backup immediately updates Settings history and selects newest snapshot");
  // Recovery moved to Transactions. Settings intentionally exposes only
  // a read-only backup comparison, never an interactive restore control.
  await page.getByRole("button", { name: "Periksa dampak cadangan" }).click();
  await page.getByRole("table", { name: "Perbandingan data cadangan" })
    .waitFor({ state: "visible", timeout: 25000 });
  await page.getByText("Pratinjau saja. Tidak ada data yang dipulihkan atau diubah.")
    .waitFor({ state: "visible" });
  assert.equal(await page.getByRole("checkbox", { name: /Pulihkan /i }).count(),0,
    "Settings must not offer Smart Restore transaction checkboxes");
  assert.equal(await page.getByRole("button", { name: /Pulihkan (data|[0-9]+ transaksi)/i }).count(),0,
    "Settings must not offer an Apply/Restore action");
  console.log("PASS: mobile Settings shows read-only backup comparison; recovery controls stay in Transactions");

  const ledgerAfterPreview = must(await admin.from("transactions")
    .select("id,amount").eq("user_id",userId),"verify read-only preview left ledger unchanged");
  assert.equal(ledgerAfterPreview.length,1);
  assert.equal(ledgerAfterPreview[0].id,initialTransactions[0].id);
  assert.equal(Number(ledgerAfterPreview[0].amount),25000);
  console.log("PASS: authenticated immutable-snapshot restore preview is read-only; invalid path, cross-origin, and anonymous calls rejected");

  // Smart Restore scenario: Nov 2 expense is accidentally deleted; a
  // separate Nov 3 expense must remain untouched during selective recovery.
  const missing = must(await admin.from("transactions").insert({
    user_id: userId, account_id: account.id, category_id: category.id,
    transaction_type: "expense", amount: 200000, currency: "IDR",
    source: "manual", source_reference: null, merchant: "Belanja supermarket",
    description: "2 November purchase",
    transaction_at: "2026-11-02T10:00:00+07:00",
  }).select("*").single(), "seed November 2 synthetic manual transaction");
  const backBeforeDelete = await context.request.post("/api/settings/backup");
  assert.equal(backBeforeDelete.status(),200,"store backup containing old transaction");
  const historyBeforeDelete = await context.request.get("/api/settings/backup/history");
  assert.equal(historyBeforeDelete.status(),200);
  const selectedSnapshot = (await historyBeforeDelete.json()).snapshots[0].name;
  const snapshotFile = await context.request.get("/api/settings/backup?snapshot=" +
    encodeURIComponent(selectedSnapshot));
  assert.equal(snapshotFile.status(),200);
  const originalSnapshot = await snapshotFile.json();
  const oldTransaction = originalSnapshot.data.transactions.find(t => t.id === missing.id);
  assert.ok(oldTransaction,"snapshot should contain missing Nov 2 transaction");

  const latest = must(await admin.from("transactions").insert({
    user_id: userId, account_id: account.id, category_id: category.id,
    transaction_type: "expense", amount: 45000, currency: "IDR",
    source: "manual", source_reference: null, merchant: "Makan 3 November",
    description: "Keep this newer expense",
    transaction_at: "2026-11-03T10:00:00+07:00",
  }).select("id,amount").single(), "seed November 3 transaction");
  must(await admin.from("transactions").delete().eq("user_id",userId).eq("id",missing.id),
    "simulate accidental deletion of old transaction");

  const beforeSmart = must(await admin.from("transactions").select("id,amount")
    .eq("user_id",userId), "verify two existing transactions before Smart Restore");
  assert.equal(beforeSmart.length,2);
  assert.ok(beforeSmart.some(t=>t.id===latest.id),"newest transaction must exist");

  // Regression: a recent backup made AFTER deletion has no missing row.
  // The history scanner must identify the older version containing it.
  const postDeleteBackup = await context.request.post("/api/settings/backup");
  assert.equal(postDeleteBackup.status(),200,"save newer snapshot without deleted transaction");
  const afterDeleteHistory = await context.request.get("/api/settings/backup/history");
  assert.equal(afterDeleteHistory.status(),200);
  const newestMissingBackup = (await afterDeleteHistory.json()).snapshots[0].name;
  assert.notEqual(newestMissingBackup,selectedSnapshot);
  const allBackupSearch = await context.request.post("/api/settings/restore/search",{
    data:{offset:0,anchor:null},
  });
  assert.equal(allBackupSearch.status(),200,"authenticated read-only backup history search");
  const found = await allBackupSearch.json();
  assert.ok(found.scanned>=2);
  assert.ok(found.matches.some(s=>s.snapshot===selectedSnapshot&&s.eligibleCount===1),
    "older backup must be found automatically");
  assert.ok(!found.matches.some(s=>s.snapshot===newestMissingBackup),
    "newest backup without missing transaction should not match");
  const badSearchOrigin=await context.request.post("/api/settings/restore/search",{
    headers:{Origin:"https://untrusted.example"},
    data:{offset:0,anchor:null},
  });
  assert.equal(badSearchOrigin.status(),403);
  const badSearchOffset=await context.request.post("/api/settings/restore/search",{
    data:{offset:10,anchor:null},
  });
  assert.equal(badSearchOffset.status(),400);
  const badSearchAnchor=await context.request.post("/api/settings/restore/search",{
    data:{offset:10,anchor:selectedSnapshot},
  });
  assert.equal(badSearchAnchor.status(),409,
    "history anchor mismatch must fail closed");
  const anonymousSearchContext = await browser.newContext();
  const anonymousSearch=await anonymousSearchContext.request.post(
    target+"/api/settings/restore/search",{
      data:{offset:0,anchor:null},maxRedirects:0,
    });
  assert.ok([307,401].includes(anonymousSearch.status()));
  await anonymousSearchContext.close();
  const currentDuringSearch = must(await admin.from("transactions").select("id,amount")
    .eq("user_id",userId), "verify scan did not alter ledger");
  assert.deepEqual(
    currentDuringSearch.map(x=>x.id).sort(),beforeSmart.map(x=>x.id).sort(),
    "read-only history search must leave existing ledger untouched");
  await page.goto("/transactions",{waitUntil:"domcontentloaded"});
  const recoverLink=page.getByRole("link",{name:"Pulihkan transaksi"});
  await recoverLink.waitFor({state:"visible",timeout:25000});
  await recoverLink.click();
  await page.getByRole("heading",{name:"Transaksi terdeteksi hilang"})
    .waitFor({state:"visible",timeout:25000});
  await page.getByRole("checkbox",{name:/Pulihkan Belanja supermarket/})
    .waitFor({state:"visible",timeout:40000});
  assert.ok(await page.getByText("Dibuat:",{exact:false}).count()>=1);
  assert.ok(await page.getByText("Tanggal transaksi:",{exact:false}).count()>=1);
  console.log("PASS: Transactions recovery inbox finds missing transaction across backups with original created_at");

  const previewSmartResponse = await context.request.post("/api/settings/restore/preview",{
    data:{snapshot:selectedSnapshot},
  });
  assert.equal(previewSmartResponse.status(),200);
  const smartPreview = await previewSmartResponse.json();
  assert.equal(smartPreview.smartRestoreEnabled,true);
  assert.equal(smartPreview.smartRestore.eligibleCount,1);
  assert.deepEqual(smartPreview.smartRestore.defaultSelectedIds,[]);
  assert.equal(smartPreview.smartRestore.candidates[0].id,missing.id);

  const request = {
    snapshot:selectedSnapshot, selectedIds:[missing.id],
    expectedBackupSha256:smartPreview.backupSha256,
    expectedCurrentSha256:smartPreview.currentSha256,
    confirmation:"PULIHKAN TRANSAKSI",
  };
  const invalidConfirmation = await context.request.post("/api/settings/restore/smart/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data:{...request,confirmation:"YES"},
  });
  assert.equal(invalidConfirmation.status(),400,"confirmation is mandatory");
  const stale = await context.request.post("/api/settings/restore/smart/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data:{...request,expectedCurrentSha256:"0".repeat(64)},
  });
  assert.equal(stale.status(),409,"stale current snapshot must fail closed");

  const foreign = await context.request.post("/api/settings/restore/smart/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1",
      Origin:"https://untrusted.example"},
    data:request,
  });
  assert.equal(foreign.status(),403,"cross-origin restore must be rejected");
  const anonymousApply = await browser.newContext();
  const denied = await anonymousApply.request.post(target + "/api/settings/restore/smart/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data:request,maxRedirects:0,
  });
  assert.ok([307,401].includes(denied.status()),
    "anonymous caller must be denied or redirected to login");
  await anonymousApply.close();

  // Force a database failure *after* the first selected INSERT to prove that
  // Postgres rolls the entire request back. This never touches production.
  const invalidRow={...oldTransaction,id:randomUUID(),
    category_id:randomUUID()};
  const broken = await userClient.rpc("restore_selected_transactions_v1",{
    p_rows:[oldTransaction,invalidRow],
  });
  assert.ok(broken.error,"invalid second transaction must reject entire batch");
  const afterBroken = must(await admin.from("transactions").select("id")
    .eq("user_id",userId),"verify atomic rollback after a rejected SQL batch");
  assert.equal(afterBroken.length,2);
  assert.ok(!afterBroken.some(t=>t.id===missing.id));
  console.log("PASS: invalid second transaction rolls back first insertion atomically");

  const chooseOld=page.getByRole("checkbox",{name:/Pulihkan Belanja supermarket/});
  assert.equal(await chooseOld.isChecked(),false,"checkbox must be empty by default");
  // Keep the established single-snapshot API test, even after the primary
  // recovery entry moves out of Settings.
  const manualApply=await context.request.post("/api/settings/restore/smart/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data:request,
  });
  assert.equal(manualApply.status(),200,"single-snapshot recovery remains compatible");
  assert.equal((await manualApply.json()).restoredCount,1);

  const restored = must(await admin.from("transactions").select("id,amount,merchant")
    .eq("user_id",userId),"verify Smart Restore final ledger");
  assert.equal(restored.length,3,"original recurring + restored old + new current");
  assert.ok(restored.some(t=>t.id===missing.id&&Number(t.amount)===200000));
  assert.ok(restored.some(t=>t.id===latest.id&&Number(t.amount)===45000));
  const historyAfter = must(await admin.storage.from("budgetku-backups")
    .list(userId + "/snapshots"),"verify safety snapshot stored before restore");
  assert.ok(historyAfter.length>=3,"restore should leave immutable safety backup");

  const attemptedRetry=await context.request.post("/api/settings/restore/smart/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},data:request,
  });
  assert.equal(attemptedRetry.status(),409,"identical retry must not duplicate");
  const noDuplicates=must(await admin.from("transactions").select("id")
    .eq("user_id",userId),"verify retry cannot duplicate");
  assert.equal(noDuplicates.length,3);
  console.log("PASS: Smart Restore checkbox restored Nov 2 manual transaction, kept Nov 3 transaction, created safety snapshot, rejected stale/replay/anonymous requests");

  
  // Regression: production categorizes transactions with globally readable
  // system categories. Their UPDATE RLS forbids SELECT FOR SHARE, but SELECT
  // and restoring an eligible manual transaction should still be allowed.
  const sysCategory = must(await admin.from("categories").insert({
    user_id: null, name: "E2E Global Restore Category",
    category_type: "expense", is_system: true, is_archived: false,
  }).select("id").single(), "create global category in disposable staging");
  globalSystemCategoryId = sysCategory.id;
  const sysExpense = must(await admin.from("transactions").insert({
    user_id: userId, account_id: account.id, category_id: sysCategory.id,
    transaction_type: "expense", amount: 72000, currency: "IDR",
    source: "manual", source_reference: null,
    merchant: "System category fixture",
    transaction_at: "2026-11-02T12:00:00+07:00",
  }).select("*").single(), "seed system-category transaction");
  const sysBackup = await context.request.post("/api/settings/backup");
  assert.equal(sysBackup.status(),200);
  const sysHistory = await context.request.get("/api/settings/backup/history");
  assert.equal(sysHistory.status(),200);
  const sysSnapshot = (await sysHistory.json()).snapshots[0].name;
  must(await admin.from("transactions").delete().eq("user_id",userId)
    .eq("id",sysExpense.id), "simulate removed system-category expense");

  const sysPreviewResp = await context.request.post("/api/settings/restore/preview", {
    data: {snapshot:sysSnapshot},
  });
  assert.equal(sysPreviewResp.status(),200);
  const sysPreview = await sysPreviewResp.json();
  assert.equal(sysPreview.smartRestore.candidates.find(t=>t.id===sysExpense.id)?.eligible,true);
  const oldLedger = must(await admin.from("transactions").select("id,amount")
    .eq("user_id",userId), "baseline before global category restore");
  const sysApply = await context.request.post("/api/settings/restore/smart/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data: {
      snapshot:sysSnapshot, selectedIds:[sysExpense.id],
      expectedBackupSha256:sysPreview.backupSha256,
      expectedCurrentSha256:sysPreview.currentSha256,
      confirmation:"PULIHKAN TRANSAKSI",
    },
  });
  assert.equal(sysApply.status(),200,"read-only global system category should restore");
  assert.equal((await sysApply.json()).restoredCount,1);
  const newLedger = must(await admin.from("transactions").select("id,amount,category_id")
    .eq("user_id",userId), "check recovered global category and existing ledger");
  assert.equal(newLedger.length,oldLedger.length+1);
  assert.ok(newLedger.some(t=>t.id===sysExpense.id && t.category_id===sysCategory.id &&
    Number(t.amount)===72000));
  assert.ok(oldLedger.every(t=>newLedger.some(n=>n.id===t.id &&
    Number(n.amount)===Number(t.amount))));
  console.log("PASS: read-only global system category recovered; existing transactions unchanged");

  // Multi-snapshot recovery regression: each disappeared transaction exists
  // in a different immutable backup. The UI must show ONE deduplicated list
  // with created-at timestamps and restore both in ONE atomic RPC.
  const firstMissing = must(await admin.from("transactions").insert({
    user_id:userId,account_id:account.id,category_id:category.id,
    transaction_type:"expense",amount:18000,currency:"IDR",
    source:"manual",source_reference:null,merchant:"Missing multi A",
    transaction_at:"2026-11-02T14:00:00+07:00",
  }).select("*").single(),"create first missing transaction");
  assert.equal((await context.request.post("/api/settings/backup")).status(),200);
  const firstHistory=await context.request.get("/api/settings/backup/history");
  const firstSnapshot=(await firstHistory.json()).snapshots[0].name;
  must(await admin.from("transactions").delete().eq("id",firstMissing.id).eq("user_id",userId),
    "remove first missing transaction");

  const secondMissing=must(await admin.from("transactions").insert({
    user_id:userId,account_id:account.id,category_id:category.id,
    transaction_type:"expense",amount:27000,currency:"IDR",
    source:"manual",source_reference:null,merchant:"Missing multi B",
    transaction_at:"2026-11-03T15:00:00+07:00",
  }).select("*").single(),"create second missing transaction");
  assert.equal((await context.request.post("/api/settings/backup")).status(),200);
  const secondHistory=await context.request.get("/api/settings/backup/history");
  const secondSnapshot=(await secondHistory.json()).snapshots[0].name;
  must(await admin.from("transactions").delete().eq("id",secondMissing.id).eq("user_id",userId),
    "remove second missing transaction");

  const preMulti=must(await admin.from("transactions").select("id,amount").eq("user_id",userId),
    "baseline before multi-source restore");
  const scanBeforeMulti=await context.request.post("/api/settings/restore/search",{
    data:{offset:0,anchor:null},
  });
  assert.equal(scanBeforeMulti.status(),200);
  const scanData=await scanBeforeMulti.json();
  const a=scanData.candidates.find(row=>row.id===firstMissing.id);
  const b=scanData.candidates.find(row=>row.id===secondMissing.id);
  assert.ok(a?.eligible && b?.eligible);
  assert.equal(typeof a.createdAt,"string");
  assert.equal(typeof b.createdAt,"string");
  assert.notEqual(firstSnapshot,secondSnapshot,"distinct immutable sources");
  assert.notEqual(a.snapshot,b.snapshot,"two deleted transactions originate from distinct verified backups");
  const selections=[
    {id:a.id,snapshot:a.snapshot,backupSha256:a.backupSha256},
    {id:b.id,snapshot:b.snapshot,backupSha256:b.backupSha256},
  ];
  const multiRequest={
    selections,expectedCurrentSha256:scanData.currentSha256,
    confirmation:"PULIHKAN TRANSAKSI",
  };
  const crossOriginMulti=await context.request.post("/api/transactions/recovery/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1",
      Origin:"https://untrusted.example"},data:multiRequest,
  });
  assert.equal(crossOriginMulti.status(),403);
  const staleMulti=await context.request.post("/api/transactions/recovery/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data:{...multiRequest,expectedCurrentSha256:"0".repeat(64)},
  });
  assert.equal(staleMulti.status(),409);
  const wrongBackupHash=await context.request.post("/api/transactions/recovery/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data:{...multiRequest,selections:[
      {...selections[0],backupSha256:"0".repeat(64)},selections[1]]},
  });
  assert.equal(wrongBackupHash.status(),409);
  const anonymousMultiCtx=await browser.newContext();
  const anonymousMulti=await anonymousMultiCtx.request.post(
    target+"/api/transactions/recovery/apply",{
      headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
      data:multiRequest,maxRedirects:0,
    });
  assert.ok([307,401].includes(anonymousMulti.status()));
  await anonymousMultiCtx.close();

  await page.goto("/transactions/recover",{waitUntil:"domcontentloaded"});
  await page.getByRole("checkbox",{name:/Pulihkan Missing multi A/})
    .waitFor({state:"visible",timeout:40000});
  await page.getByRole("checkbox",{name:/Pulihkan Missing multi B/})
    .waitFor({state:"visible",timeout:40000});
  const bothA=page.getByRole("checkbox",{name:/Pulihkan Missing multi A/});
  const bothB=page.getByRole("checkbox",{name:/Pulihkan Missing multi B/});
  assert.equal(await bothA.isChecked(),false);
  assert.equal(await bothB.isChecked(),false);
  await bothA.check();
  await bothB.check();
  await page.getByRole("button",{name:"Lihat dampak 2 transaksi terpilih"}).click();
  await page.getByLabel("Ketik PULIHKAN TRANSAKSI untuk mengonfirmasi")
    .fill("PULIHKAN TRANSAKSI");
  await page.getByRole("button",{name:"Pulihkan 2 transaksi"}).click();
  await page.getByText("2 transaksi berhasil dipulihkan. Transaksi lainnya dipertahankan.")
    .waitFor({state:"visible",timeout:30000});

  const postMulti=must(await admin.from("transactions").select("id,amount").eq("user_id",userId),
    "ledger after combined restore");
  assert.equal(postMulti.length,preMulti.length+2);
  assert.ok(postMulti.some(row=>row.id===firstMissing.id && Number(row.amount)===18000));
  assert.ok(postMulti.some(row=>row.id===secondMissing.id && Number(row.amount)===27000));
  assert.ok(preMulti.every(previous=>postMulti.some(row=>
    row.id===previous.id && Number(row.amount)===Number(previous.amount))),
    "pre-existing financial records must be unchanged");
  const repeatedMulti=await context.request.post("/api/transactions/recovery/apply",{
    headers:{"X-Budgetku-Smart-Restore-Intent":"budgetku-smart-restore-v1"},
    data:multiRequest,
  });
  assert.equal(repeatedMulti.status(),409,"stale repeated action must not duplicate");
  console.log("PASS: Transactions inbox restored two missing records from different backups in one atomic request, preserving existing ledger");




  await context.close();
} finally {
  if (browser) await browser.close();
  // Cleanup only inside the explicitly guarded staging project. Report
  // failures; never silently leave a test account holding financial data.
  if (userId) {
    const storage = admin.storage.from("budgetku-backups");
    const { data: snapshots } = await storage.list(userId + "/snapshots");
    if (snapshots?.length) {
      must(await storage.remove(snapshots.map((s) => userId + "/snapshots/" + s.name)),
        "cleanup synthetic backup snapshots");
    }
    await storage.remove([userId + "/latest.json"]);
    for (const table of ["goal_contributions", "transactions", "recurring_transactions",
      "budget_items", "budgets", "financial_goals", "merchant_rules", "accounts", "categories"]) {
      const result = await admin.from(table).delete().eq("user_id", userId);
      if (result.error) console.error("Cleanup needs review for " + table);
    }
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw new Error("Synthetic staging account could not be removed.");
  }
  if (globalSystemCategoryId) {
    const removed = await admin.from("categories").delete().eq("id",globalSystemCategoryId);
    if (removed.error) throw new Error("Staging global category cleanup failed.");
  }
}
