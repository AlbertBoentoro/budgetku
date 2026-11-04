// One-time, read-only diagnostic for the already isolated Supabase staging project.
// Prints aggregate counts only. Never logs user IDs, email, transaction details,
// tokens, file names, or backup contents. Never writes to Supabase.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createSmartRestorePlan } from "../../lib/settings/smart-restore-plan.mjs";

const STAGING_REF = "omnzuolrlwczvnxrvenw";
const PRODUCTION_REF = "zvmqrrttdrqkyrdzyxlf";
const ref = process.env.STAGING_PROJECT_REF;
const url = process.env.STAGING_SUPABASE_URL;
const secret = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
assert.equal(ref, STAGING_REF);
assert.equal(url, `https://${STAGING_REF}.supabase.co`);
assert.ok(secret && secret.length > 20);
assert.ok(!url.includes(PRODUCTION_REF));

const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function must(result, operation) {
  if (result.error || result.data == null) {
    throw new Error(`Read-only staging audit failed: ${operation}`);
  }
  return result.data;
}

const users = must(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), "staging users").users
  .filter(user => !user.email?.startsWith("budgetku-e2e-"));
if (users.length !== 1) {
  throw new Error("Refusing to inspect an ambiguous number of non-synthetic staging users");
}
const userId = users[0].id;

const [tx,accounts,categories] = await Promise.all([
  db.from("transactions").select("*").eq("user_id",userId),
  db.from("accounts").select("*").eq("user_id",userId),
  db.from("categories").select("*").or(`user_id.eq.${userId},user_id.is.null`),
]);
const current = { data: {
  transactions: must(tx,"current transactions"),
  accounts: must(accounts,"current accounts"),
  categories: must(categories,"current categories"),
} };
const present = new Set(current.data.transactions.map(t => t.id));

const entries = must(
  await db.storage.from("budgetku-backups").list(userId + "/snapshots", {
    limit: 500, sortBy: { column:"name",order:"desc" },
  }), "snapshot history"
);
const seen = new Set();
const snapshots = [];
for (const row of entries) {
  if (!row.name.endsWith(".json")) continue;
  const match = row.name.match(/-([0-9a-f]{32})\.json$/i);
  if (!match) throw new Error("Found non-verifiable backup snapshot");
  const file = must(
    await db.storage.from("budgetku-backups")
      .download(userId + "/snapshots/" + row.name), "immutable backup download"
  );
  const json = await file.text();
  const hash = createHash("sha256").update(json).digest("hex");
  if (!hash.startsWith(match[1])) throw new Error("Immutable backup checksum mismatch");
  const incoming = JSON.parse(json);
  assert.equal(incoming.format,"budgetku-backup");
  assert.equal(incoming.version,1);
  const plan = createSmartRestorePlan({ incoming,current,userId });
  for (const t of incoming.data.transactions) seen.add(t.id);
  const created = new Date(row.created_at ?? row.name.slice(0,10));
  const time = Number.isFinite(created.getTime())
    ? new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"}).format(created)+" WIB"
    : "timestamp unavailable";
  snapshots.push({
    createdWib: time,
    transactionCount: incoming.data.transactions.length,
    presentCount: plan.alreadyPresent,
    missingCount: plan.candidates.length,
    eligibleCount: plan.eligibleCount,
    blockedCount: plan.blockedCount,
  });
}
const countBackedAndMissing = [...seen].filter(id=>!present.has(id)).length;
const backedAndPresent = [...seen].filter(id=>present.has(id)).length;
const activeNeverBacked = [...present].filter(id=>!seen.has(id)).length;
const report = {
  snapshotCount: snapshots.length,
  activeTransactions: present.size,
  uniqueTransactionsAcrossSnapshots: seen.size,
  backedStillActive: backedAndPresent,
  backedMissingNow: countBackedAndMissing,
  activeNeverSeenInSnapshots: activeNeverBacked,
  snapshots,
};
console.log("STAGING_READ_ONLY_AUDIT " + JSON.stringify(report));
// Never infer a missing transaction existed unless a valid backup holds it.
// Never synthesize recovery candidates or change current user data.
