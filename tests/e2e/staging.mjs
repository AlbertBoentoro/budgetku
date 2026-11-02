// End-to-end browser test against a LOCAL Next.js server and a dedicated
// disposable Supabase STAGING project. Never target production resources.
// GitHub Actions secrets stay within the runner and are never printed.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const PRODUCTION_REF = "zvmqrrttdrqkyrdzyxlf";
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
    stageRef === PRODUCTION_REF || url.includes(PRODUCTION_REF) ||
    !["http://127.0.0.1:3000", "http://localhost:3000"].includes(target)) {
  throw new Error("Staging safety guard: refused possible production environment.");
}
const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let userId;
let browser;
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
  console.log("PASS: browser expense saved once to staging and balance arithmetic matches");

  // Test backup API through browser's authenticated HTTP context. This
  // creates test-user-only storage objects on staging, never production.
  const backupResponse = await context.request.post("/api/settings/backup");
  assert.equal(backupResponse.status(), 200, "manual staging backup should succeed");
  const inspection = await context.request.get("/api/settings/backup/inspect");
  assert.equal(inspection.status(), 200);
  const check = await inspection.json();
  assert.equal(check.valid, true);
  assert.equal(check.counts.transactions, 1);
  console.log("PASS: authenticated backup can be created and inspected on staging");

  const history = await context.request.get("/api/settings/backup/history");
  assert.equal(history.status(), 200);
  const archives = (await history.json()).snapshots;
  assert.ok(archives.length >= 1);
  const download = await context.request.get("/api/settings/backup?snapshot=" +
    encodeURIComponent(archives[0].name));
  assert.equal(download.status(), 200);
  console.log("PASS: versioned snapshot can be downloaded by synthetic staging user");

  // A synthetic Gmail import links to this transaction. Restore preview must
  // preserve it without changing, creating or deleting ANY ledger rows.
  must(await admin.from("email_imports").insert({
    user_id: userId,
    transaction_id: (must(await admin.from("transactions").select("id")
      .eq("user_id", userId).single(), "get staging transaction")).id,
    gmail_message_id: "synthetic-e2e-only",
  }), "seed synthetic Gmail transaction link");
  const previewResponse = await context.request.post("/api/settings/restore/preview", {
    data: {},
  });
  assert.equal(previewResponse.status(), 200, "read-only restore preview should succeed");
  const preview = await previewResponse.json();
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.eligibleForAtomicRestore, true);
  assert.equal(preview.externalGmailLinks, 1);
  assert.equal(preview.tables.transactions.current, 1);
  assert.equal(preview.tables.transactions.wouldRemove, 0);
  console.log("PASS: read-only preview preserves a synthetic Gmail-linked transaction");

  const row = must(await admin.from("transactions").select("id").eq("user_id", userId)
    .single(), "get protected synthetic transaction");
  must(await admin.from("transactions").update({ amount: 27000 }).eq("id", row.id)
    .eq("user_id", userId), "change synthetic ledger after backup");
  const conflictResponse = await context.request.post("/api/settings/restore/preview", {
    data: {},
  });
  assert.equal(conflictResponse.status(), 200);
  const conflict = await conflictResponse.json();
  assert.equal(conflict.eligibleForAtomicRestore, false);
  assert.ok(conflict.blockers.some((text) => text.includes("Gmail-linked")));
  const latest = must(await admin.from("transactions").select("amount")
    .eq("user_id", userId).single(), "verify preview did not modify ledger");
  assert.equal(Number(latest.amount), 27000);
  console.log("PASS: preview blocks Gmail-linked changes without modifying live staging data");

  // Staging-only proof of atomic restore and database rollback.
  // The real Google OAuth integration, customer data, and production RPC
  // are never used. A caller-authenticated client exercises PostgreSQL RLS.
  const userClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  must(await userClient.auth.signInWithPassword({ email, password }),
    "authenticate staging caller for protected restore RPC");
  const originalSnapshotDownload = must(
    await admin.storage.from("budgetku-backups").download(userId + "/latest.json"),
    "load verified staging-only original snapshot");
  const originalSnapshot = JSON.parse(await originalSnapshotDownload.text());
  const expectedTables = {
    accounts: "accounts",
    categories: "categories",
    budgets: "budgets",
    budgetItems: "budget_items",
    transactions: "transactions",
    recurringTransactions: "recurring_transactions",
    financialGoals: "financial_goals",
    goalContributions: "goal_contributions",
    merchantRules: "merchant_rules",
  };
  async function stagingBaseline() {
    const data = {};
    for (const [key, table] of Object.entries(expectedTables)) {
      data[key] = must(await admin.from(table).select("*")
        .eq("user_id", userId).order("id"), "read baseline " + table);
    }
    return data;
  }
  const refused = await userClient.rpc("budgetku_restore_atomic_v1_test", {
    p_backup_data: originalSnapshot.data,
    p_expected_current_data: await stagingBaseline(),
    p_force_rollback: false,
  });
  assert.ok(refused.error && refused.error.message.includes("Gmail-linked transaction conflict"),
    "atomic restore must reject modified Gmail-linked expense; instead got: " +
      (refused.error?.code ?? "no error") + " " + (refused.error?.message ?? "success"));
  assert.equal(Number(must(await admin.from("transactions").select("amount")
    .eq("id", row.id).single(), "verify Gmail conflict left ledger intact").amount), 27000);
  console.log("PASS: database denies destructive Gmail-linked transaction restore");

  must(await admin.from("transactions").update({amount: 25000}).eq("id", row.id),
    "return linked staging record to its snapshot value");
  const disposable = must(await admin.from("transactions").insert({
    user_id: userId, account_id: account.id, category_id: category.id,
    transaction_type: "expense", amount: 9000, source: "manual",
  }).select("id").single(), "add unlinked synthetic expense for rollback test");
  const baseline = await stagingBaseline();
  const rollback = await userClient.rpc("budgetku_restore_atomic_v1_test", {
    p_backup_data: originalSnapshot.data,
    p_expected_current_data: baseline,
    p_force_rollback: true,
  });
  assert.ok(rollback.error?.message.includes("Injected failure"),
    "mid-restore injected failure must reject entire atomic RPC");
  const stillExists = must(await admin.from("transactions").select("id")
    .eq("id", disposable.id).single(), "verify rollback preserved extra expense");
  assert.equal(stillExists.id, disposable.id);
  assert.equal(must(await admin.from("email_imports").select("transaction_id")
    .eq("user_id", userId).single(), "verify rollback preserved Gmail link").transaction_id, row.id);
  console.log("PASS: atomic mid-restore failure rolls back ledger and Gmail link");

  const applied = must(await userClient.rpc("budgetku_restore_atomic_v1_test", {
    p_backup_data: originalSnapshot.data,
    p_expected_current_data: await stagingBaseline(),
    p_force_rollback: false,
  }), "apply staging-only atomic restore");
  assert.equal(applied.restored, true);
  assert.equal(applied.transactions, 1);
  const finalRows = must(await admin.from("transactions").select("id,amount")
    .eq("user_id", userId), "verify successful staging-only atomic restore");
  assert.equal(finalRows.length, 1);
  assert.equal(finalRows[0].id, row.id);
  assert.equal(Number(finalRows[0].amount), 25000);
  assert.equal(must(await admin.from("email_imports").select("transaction_id")
    .eq("user_id", userId).single(), "verify Gmail link retained").transaction_id, row.id);
  console.log("PASS: caller-RLS atomic restore recovered one expense without breaking Gmail link");

  // Application-level protected restore: immutable snapshot selection,
  // preview hash, explicit confirmation and mandatory pre-restore backup.
  const originalArchive = archives[0].name;
  must(await admin.from("transactions").insert({
    user_id: userId, account_id: account.id, category_id: category.id,
    transaction_type: "expense", amount: 12000, source: "manual",
  }), "create extra unlinked transaction for preview");

  const approvedResponse = await context.request.post("/api/settings/restore/preview", {
    data: { snapshot: originalArchive },
  });
  assert.equal(approvedResponse.status(), 200);
  const approved = await approvedResponse.json();
  assert.equal(approved.eligibleForAtomicRestore, true);
  assert.equal(approved.tables.transactions.wouldRemove, 1);
  assert.match(approved.currentSha256, /^[a-f0-9]{64}$/);
  const applyUrl = "/api/settings/restore/apply";
  const headers = { "X-Budgetku-Restore-Intent": "staging-v1-confirmed" };
  const payload = {
    snapshot: originalArchive,
    expectedBackupSha256: approved.backupSha256,
    expectedCurrentSha256: approved.currentSha256,
    confirmation: "PULIHKAN DATA",
  };
  const noProof = await context.request.post(applyUrl, { data: payload });
  assert.equal(noProof.status(), 403, "apply endpoint must require explicit intent header");
  const noConfirm = await context.request.post(applyUrl, {
    headers, data: { ...payload, confirmation: "wrong" },
  });
  assert.equal(noConfirm.status(), 400, "apply endpoint must require typed phrase");
  const wrongHash = await context.request.post(applyUrl, {
    headers, data: { ...payload, expectedBackupSha256: "0".repeat(64) },
  });
  assert.equal(wrongHash.status(), 409, "backup fingerprint mismatch must block restore");

  // Simulate data arriving after user approved the preview.
  must(await admin.from("transactions").insert({
    user_id: userId, account_id: account.id, category_id: category.id,
    transaction_type: "expense", amount: 7000, source: "manual",
  }), "create a transaction after preview was approved");
  const stale = await context.request.post(applyUrl, { headers, data: payload });
  assert.equal(stale.status(), 409, "stale impact preview must refuse restoration");
  const staleData = must(await admin.from("transactions").select("id")
    .eq("user_id", userId), "verify stale preview did not delete newer data");
  assert.equal(staleData.length, 3);
  console.log("PASS: staging endpoint blocks missing intent, missing confirmation, wrong checksum, and stale impact preview");

  // UI shows BOTH rows that would be removed, and requires typed confirmation.
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const chosen = page.locator("#restore-snapshot");
  await chosen.waitFor({ state: "visible", timeout: 25000 });
  await chosen.selectOption(originalArchive);
  await page.getByRole("button", { name: "Periksa dampak Restore" }).click();
  const restoreRow = page.locator("tbody tr").filter({
    has: page.getByText("Transaksi", { exact: true }),
  });
  try {
    await restoreRow.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    const state = await page.locator('section[aria-labelledby="restore-title"]').innerText();
    throw new Error("Staging restore preview table did not render: " + state.slice(0, 1200));
  }
  assert.equal((await restoreRow.locator("td").last().textContent())?.trim(), "2");
  const restoreButton = page.getByRole("button", { name: "Pulihkan data staging" });
  assert.equal(await restoreButton.isDisabled(), true, "restoration disabled before typed confirmation");
  await page.locator("#restore-confirm").fill("PULIHKAN DATA");
  assert.equal(await restoreButton.isEnabled(), true);
  await restoreButton.click();
  await page.getByText(/Restore staging berhasil/).waitFor({ state: "visible", timeout: 30000 });

  const afterApply = must(await admin.from("transactions").select("id,amount")
    .eq("user_id", userId), "verify protected UI restoration");
  assert.equal(afterApply.length, 1, "approved snapshot must restore exactly one ledger row");
  assert.equal(afterApply[0].id, row.id, "restore must preserve linked transaction identity");
  assert.equal(Number(afterApply[0].amount), 25000);
  const linkedAfter = must(await admin.from("email_imports")
    .select("transaction_id").eq("user_id", userId).single(), "verify imported link after UI restore");
  assert.equal(linkedAfter.transaction_id, row.id);

  const safetyHistory = await context.request.get("/api/settings/backup/history");
  assert.equal(safetyHistory.status(), 200);
  const safetyArchives = (await safetyHistory.json()).snapshots;
  const createdSafety = safetyArchives.filter((entry) => entry.name !== originalArchive);
  assert.equal(createdSafety.length, 1, "a new immutable pre-restore safety snapshot should exist");
  const safetyDownload = await context.request.get(
    "/api/settings/backup?snapshot=" + encodeURIComponent(createdSafety[0].name));
  assert.equal(safetyDownload.status(), 200);
  const safetyData = await safetyDownload.json();
  assert.equal(safetyData.data.transactions.length, 3,
    "safety snapshot must preserve all three pre-restore ledger rows");
  console.log("PASS: user-confirmed staging Restore preserved Gmail link and verified pre-restore backup holds deleted rows");

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
    for (const table of ["email_imports", "goal_contributions", "transactions", "recurring_transactions",
      "budget_items", "budgets", "financial_goals", "merchant_rules", "accounts", "categories"]) {
      const result = await admin.from(table).delete().eq("user_id", userId);
      if (result.error) console.error("Cleanup needs review for " + table);
    }
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw new Error("Synthetic staging account could not be removed.");
  }
}
