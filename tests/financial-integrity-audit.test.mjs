// Phase 1 financial-integrity audit: regression and defect tests.
//
// Two kinds of test live here:
// - Plain tests guard behaviour that is correct today. They must keep passing.
// - Tests marked { todo } assert the CORRECT behaviour for a confirmed defect
//   (see docs/audits/2026-11-phase-1-financial-integrity.md). They fail today
//   by design; node:test reports them as todo without failing the run. Remove
//   the todo marker when the defect is fixed.
//
// No database, network, or credentials are used.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

// Resolve the app's "@/..." alias (tsconfig paths) and extensionless .ts
// imports, so lib modules that use the alias can be loaded in plain Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const base = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), root)
      : (specifier.startsWith("./") || specifier.startsWith("../")) &&
          context.parentURL?.endsWith(".ts") &&
          !/\.[cm]?[jt]s$/.test(specifier)
        ? new URL(specifier, context.parentURL)
        : null;
    if (base) {
      for (const suffix of ["", ".ts", "/index.ts"]) {
        const candidate = new URL(base.href + suffix);
        if (existsSync(fileURLToPath(candidate)) && !candidate.pathname.endsWith("/")) {
          return { url: candidate.href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const source = (path) => readFileSync(new URL(path, root), "utf8");

// Body of a top-level function, from its declaration to the next top-level
// declaration. Enough for the source-level checks below.
function functionBody(text, name) {
  const start = text.search(new RegExp(`(export )?(async )?function ${name}\\b`));
  assert.notEqual(start, -1, `${name} not found`);
  const rest = text.slice(start + 1);
  const next = rest.search(/\n(export )?(async )?function \w+/);
  return text.slice(start, next === -1 ? undefined : start + 1 + next);
}

// Snapshot of the live CHECK constraint, read on 2026-11-05 with
// pg_get_constraintdef on public.accounts (read-only):
// CHECK (account_type = ANY (ARRAY['bank','cash','ewallet','credit_card','investment','other']))
const LIVE_ACCOUNT_TYPE_CHECK = ["bank", "cash", "ewallet", "credit_card", "investment", "other"];

// ---------------------------------------------------------------------------
// F-02 Account types offered by the form vs the database constraint.

test(
  "F-02: every account type offered in the form is accepted by the database",
  { todo: "F-02: e_wallet and savings are rejected by accounts_account_type_check" },
  async () => {
    const { ACCOUNT_TYPES } = await import("../lib/accounts.ts");
    const rejected = ACCOUNT_TYPES.map((t) => t.value).filter(
      (value) => !LIVE_ACCOUNT_TYPE_CHECK.includes(value),
    );
    assert.deepEqual(rejected, []);
  },
);

test("F-02 evidence: the form offers exactly the six types the audit checked", async () => {
  const { ACCOUNT_TYPES } = await import("../lib/accounts.ts");
  assert.deepEqual(
    ACCOUNT_TYPES.map((t) => t.value),
    ["cash", "bank", "e_wallet", "credit_card", "savings", "investment"],
  );
});

// ---------------------------------------------------------------------------
// F-03 Editing a transaction rewrites its provenance.

test(
  "F-03: updateTransaction keeps source and source_reference of the edited row",
  { todo: "F-03: updateTransaction writes source 'manual' and source_reference null" },
  () => {
    const actions = source("app/(app)/transactions/actions.ts");
    const update = functionBody(actions, "updateTransaction");
    const payload = functionBody(actions, "buildPayload");
    const updateUsesSharedPayload = /\.update\(buildPayload\(/.test(update);
    const payloadForcesProvenance =
      /source:\s*"manual"/.test(payload) && /source_reference:\s*null/.test(payload);
    assert.equal(
      updateUsesSharedPayload && payloadForcesProvenance,
      false,
      "an edit of a Gmail or recurring row would turn it into a manual row",
    );
  },
);

test("F-03 impact: Gmail reconciliation finds imports only by source='email' + message id", () => {
  const gmail = source("app/(app)/settings/gmail/actions.ts");
  assert.match(gmail, /\.eq\("source", "email"\)\s*\n\s*\.eq\("source_reference", gmailMessageId\)/);
});

// ---------------------------------------------------------------------------
// F-04 Amount rules differ between layers.

test(
  "F-04: server-side transaction validation requires a safe integer amount",
  { todo: "F-04: validate() accepts 12.5 or 1e300 from a direct server-action call" },
  () => {
    const validate = functionBody(source("app/(app)/transactions/actions.ts"), "validate");
    assert.match(validate, /Number\.isSafeInteger\(input\.amount\)|Number\.isInteger\(input\.amount\)/);
  },
);

test(
  "F-04: the create RPC amount cap fits in a JavaScript number and matches the restore cap",
  { todo: "F-04: create allows up to 1e17, restore allows up to 1e12" },
  () => {
    const createCap = Number(
      /p_amount > (\d+)/.exec(source("docs/sql/2026-11-p0-create-transaction-recurring-atomic.sql"))[1],
    );
    const restoreCap = Number(
      /v_row\.amount > (\d+)/.exec(source("docs/sql/2026-11-p0-smart-restore-system-category-fix.sql"))[1],
    );
    assert.ok(createCap <= Number.MAX_SAFE_INTEGER, `create cap ${createCap} exceeds 2^53 - 1`);
    assert.equal(createCap, restoreCap);
  },
);

test("F-04 evidence: an amount above 2^53 loses precision in the balance fold", async () => {
  const { computeTransactionEffects } = await import("../lib/account-balance-math.ts");
  const effects = computeTransactionEffects([
    { account_id: "A", destination_account_id: null, amount: "9007199254740993", transaction_type: "income" },
  ]);
  // The stored numeric is ...993; the folded balance is ...992.
  assert.equal(effects.get("A"), 9007199254740992);
});

test("amounts within the restore cap stay exact in the balance fold", async () => {
  const { computeTransactionEffects } = await import("../lib/account-balance-math.ts");
  const effects = computeTransactionEffects([
    { account_id: "A", destination_account_id: null, amount: "999999999999", transaction_type: "income" },
    { account_id: "A", destination_account_id: null, amount: "999999999999", transaction_type: "income" },
    { account_id: "A", destination_account_id: "B", amount: "1", transaction_type: "transfer" },
  ]);
  assert.equal(effects.get("A"), 1999999999997);
  assert.equal(effects.get("B"), 1);
});

// ---------------------------------------------------------------------------
// F-07 Update and delete report success when no row matched.

test(
  "F-07: updateTransaction and deleteTransaction check that a row was affected",
  { todo: "F-07: both return { ok: true } for a missing or foreign id" },
  () => {
    const actions = source("app/(app)/transactions/actions.ts");
    for (const name of ["updateTransaction", "deleteTransaction"]) {
      const body = functionBody(actions, name);
      assert.match(body, /\.select\(|count:/, `${name} does not read back the affected rows`);
    }
  },
);

// ---------------------------------------------------------------------------
// Regression guards: money totals must read every row (PostgREST caps a
// response at 1000 rows by default). These pass today.

const PAGINATED_MONEY_QUERIES = [
  ["lib/accounts.ts", "computeAccountBalances"],
  ["lib/transactions.ts", "computeMonthIncomeExpense"],
  ["lib/reports.ts", "computeExpenseByCategory"],
  ["lib/reports.ts", "computeMonthlyTrend"],
  ["lib/budgets.ts", "computeCategorySpending"],
];

for (const [file, name] of PAGINATED_MONEY_QUERIES) {
  test(`money total ${name} pages through all rows`, () => {
    const body = functionBody(source(file), name);
    assert.match(body, /fetchAllPages\(/, `${name} must use fetchAllPages`);
    assert.match(body, /\.range\(/, `${name} must request explicit ranges`);
    assert.match(body, /\.order\(/, `${name} must use a stable order for paging`);
  });
}

test("money totals scope every transactions query by user_id", () => {
  for (const [file, name] of PAGINATED_MONEY_QUERIES) {
    assert.match(functionBody(source(file), name), /\.eq\("user_id", userId\)/, `${name} is not user-scoped`);
  }
});

test(
  "F-06: the transaction ledger list pages past 1000 rows",
  { todo: "F-06: buildTransactionListQuery has no range; ?month=all can be cut off" },
  () => {
    const page = source("app/(app)/transactions/page.tsx");
    const call = page.slice(page.indexOf("await buildTransactionListQuery("), page.indexOf("await buildTransactionListQuery(") + 400);
    assert.match(call + functionBody(source("lib/transactions.ts"), "buildTransactionListQuery"), /\.range\(|fetchAllPages\(/);
  },
);

// ---------------------------------------------------------------------------
// Transfer math guarded by the database (pass today). The DB CHECK
// transactions_check requires destination IS NOT NULL AND <> account_id for
// transfers, so the null-destination case below cannot be stored.

test("transfers move money between own accounts without changing the total", async () => {
  const { computeTransactionEffects, sumRunningAccountBalances } = await import("../lib/account-balance-math.ts");
  const effects = computeTransactionEffects([
    { account_id: "A", destination_account_id: "B", amount: 250000, transaction_type: "transfer" },
    { account_id: "B", destination_account_id: "A", amount: 100000, transaction_type: "transfer" },
  ]);
  assert.equal(effects.get("A"), -150000);
  assert.equal(effects.get("B"), 150000);
  const accounts = [
    { id: "A", initial_balance: 1000000, include_in_total: true },
    { id: "B", initial_balance: 0, include_in_total: true },
  ];
  const balances = new Map(accounts.map((a) => [a.id, a.initial_balance + (effects.get(a.id) ?? 0)]));
  assert.equal(sumRunningAccountBalances(accounts, balances), 1000000);
});

test("transaction, recurring, and DB layers all require transfer destination != source", () => {
  const tx = functionBody(source("app/(app)/transactions/actions.ts"), "validate");
  assert.match(tx, /destination_account_id === input\.account_id/);
  assert.match(source("docs/sql/2026-11-p0-create-transaction-recurring-atomic.sql"), /p_destination_account_id = p_account_id/);
});

// ---------------------------------------------------------------------------
// F-01 Monthly recurrence drifts after a short month. The defect is in SQL
// (generate_recurring_now); its regression test is
// tests/sql/recurring-month-end-anchor.sql. This guard keeps the audit honest:
// the SQL still advances from the previous due date, not from start_date.

test(
  "F-01: generate_recurring_now computes the next monthly date from start_date",
  { todo: "F-01: Jan 31 -> Feb 28 -> Mar 28 (expected Mar 31)" },
  () => {
    const sql = source("docs/sql/2026-11-p0-atomic-recurring.sql");
    assert.doesNotMatch(sql, /WHEN 'monthly' THEN v_next := \(v_due \+ make_interval\(months/);
  },
);
