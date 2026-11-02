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
    .select("id,amount,transaction_type,account_id,category_id")
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
  // Restore tests are performed exclusively against the guarded staging URL.
  // A Gmail import points to the first transaction. Its FK must survive
  // an atomic restore when the snapshot retains the same transaction ID.
  const linkedFirst = must(await admin.from("email_imports").insert({
    user_id: userId, transaction_id: transactions[0].id,
    gmail_message_id: "synthetic-first-gmail",
  }).select("id").single(), "seed synthetic Gmail link");
  assert.ok(linkedFirst.id);

  const originalSnapshot = archives[0].name;
  const originalSha = (await (await context.request.get(
    "/api/settings/backup/inspect?snapshot=" + encodeURIComponent(originalSnapshot),
  )).json()).sha256;
  assert.match(originalSha, /^[0-9a-f]{64}$/);

  // Add a second fake transaction through the UI. The snapshot to restore
  // still contains only the first transaction.
  await page.goto("/transactions/new", { waitUntil: "domcontentloaded" });
  const amountTwo = page.getByLabel("Nominal Pengeluaran");
  await amountTwo.waitFor({ state: "visible", timeout: 25000 });
  await amountTwo.fill("7000");
  await page.getByLabel("Kategori").selectOption(category.id);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.waitForURL((next) => next.pathname === "/transactions", { timeout: 25000 });
  const beforeRestore = must(await admin.from("transactions")
    .select("id,amount").eq("user_id",userId), "read before staged restore");
  assert.equal(beforeRestore.length, 2);
  const laterTransaction = beforeRestore.find((item) => Number(item.amount)===7000);
  assert.ok(laterTransaction?.id);
  const linkedSecond = must(await admin.from("email_imports").insert({
    user_id: userId, transaction_id: laterTransaction.id,
    gmail_message_id: "synthetic-new-gmail",
  }).select("id").single(), "seed second Gmail-linked transaction");
  assert.ok(linkedSecond.id);


  const preview = await context.request.post("/api/settings/backup/restore", {
    data: { mode: "preview", snapshot: originalSnapshot },
  });
  assert.equal(preview.status(), 200, await preview.text());
  const previewResult = await preview.json();
  assert.equal(previewResult.ok, true);
  assert.equal(previewResult.counts.transactions, 1);
  assert.equal(previewResult.sha256, originalSha);
  console.log("PASS: restore preview verifies archived snapshot without modifying data");

  const badRequest = await context.request.post("/api/settings/backup/restore", {
    data: { mode: "apply", snapshot: originalSnapshot, sha256: "wrong", confirmation: "PULIHKAN" },
  });
  assert.equal(badRequest.status(), 409);
  assert.equal(must(await admin.from("transactions").select("id").eq("user_id",userId),
    "check wrong-hash rejection").length,2);
  console.log("PASS: wrong checksum is rejected without changing the staging ledger");

  // A forged account reference produces a foreign-key exception after the
  // atomic function begins. PostgreSQL must roll back every DB change.
  const signedIn = createClient(url, key);
  must(await signedIn.auth.signInWithPassword({email,password}), "test RPC login");
  const snapshotBody = await download.json();
  snapshotBody.data.transactions[0].account_id = randomBytes(16).toString("hex")
    .replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
  const attacked = await signedIn.rpc("restore_budgetku_backup_v1", {
    p_backup: snapshotBody,
  });
  assert.ok(attacked.error, "Invalid FK must fail restore");
  assert.equal(must(await admin.from("transactions").select("id").eq("user_id",userId),
    "verify rollback").length,2);
  console.log("PASS: invalid foreign key rolls back atomic restore and preserves ledger");

  const blocked = await context.request.post("/api/settings/backup/restore", {
    data: {
      mode: "apply", snapshot: originalSnapshot, sha256: originalSha,
      confirmation: "PULIHKAN",
    },
  });
  assert.equal(blocked.status(),409, "Gmail-linked transaction missing from snapshot should block restore");
  assert.equal(must(await admin.from("transactions").select("id").eq("user_id",userId),
    "verify Gmail block").length,2);
  console.log("PASS: Gmail-linked transaction missing from backup blocks destructive restore");
  must(await admin.from("email_imports").delete().eq("id",linkedSecond.id)
    .eq("user_id",userId), "remove synthetic second Gmail link");
  // The surviving first Gmail import must remain linked after restore.

  const applied = await context.request.post("/api/settings/backup/restore", {
    data: {
      mode: "apply", snapshot: originalSnapshot, sha256: originalSha,
      confirmation: "PULIHKAN",
    },
  });
  assert.equal(applied.status(), 200, await applied.text());
  const appliedData = await applied.json();
  assert.equal(appliedData.ok,true);
  assert.equal(appliedData.restored.transactions,1);
  const afterRestore = must(await admin.from("transactions")
    .select("id,amount").eq("user_id",userId), "verify restored ledger");
  assert.equal(afterRestore.length,1);
  assert.equal(Number(afterRestore[0].amount),25000);
  const survivingLink = must(await admin.from("email_imports")
    .select("transaction_id").eq("id",linkedFirst.id).single(),
    "inspect first Gmail link after restore");
  assert.equal(survivingLink.transaction_id,transactions[0].id);
  console.log("PASS: retained Gmail import stays linked to restored transaction ID");

  const safetyHistory = await context.request.get("/api/settings/backup/history");
  assert.equal(safetyHistory.status(),200);
  const safetySnapshots = (await safetyHistory.json()).snapshots;
  assert.ok(safetySnapshots.length>=2, "A safety backup must be created before restoring");
  console.log("PASS: exact snapshot restored atomically, prior state archived as safety snapshot");

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
