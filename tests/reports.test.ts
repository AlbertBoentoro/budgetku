import assert from "node:assert/strict";
import { describe, test } from "node:test";

// The loaders are module-private (a Next.js page may only export `default` and
// route config). tests/setup/register.mjs adds the named exports to the test
// copy of the module when it is imported with "?expose=".
const PAGE = "@/app/(app)/reports/page.tsx?expose=loadReportSections";

interface ReportSections {
  summary: { income: number; expense: number; incomplete: boolean };
  categories: {
    data: { name: string; amount: number; percent: number; colorIndex: number }[];
    incomplete: boolean;
  };
  trend: {
    points: { month: string; label: string; income: number; expense: number }[];
    incomplete: boolean;
  };
  budget: {
    rows: {
      categoryName: string;
      planned: number;
      spent: number;
      remaining: number;
      isOverBudget: boolean;
      barPercent: number;
    }[];
    exists: boolean;
    incomplete: boolean;
  };
}
type LoadReportSections = (
  supabase: unknown,
  userId: string,
  monthParam: string,
) => Promise<ReportSections>;

const { loadReportSections } = (await import(PAGE)) as {
  loadReportSections: LoadReportSections;
};

// ---------------------------------------------------------------------------
// A stand-in for the Supabase server client. It records each query's builder
// calls and asks `route` for the result, which may be delayed or rejected.

type Call = [string, ...unknown[]];
type QueryResult = { data: unknown; error: { message: string } | null };

interface Query {
  table: string;
  calls: Call[];
  kind: string;
  startedAt?: number;
  settledAt?: number;
}

type Reply = QueryResult | Error | { delayMs: number; result: QueryResult | Error };
type Route = (query: Query) => Reply;

// Which report query this is, from its table and builder calls.
function kindOf(table: string, calls: Call[]): string {
  const select = calls.find((c) => c[0] === "select")?.[1];
  const has = (method: string, column?: string) =>
    calls.some((c) => c[0] === method && (column === undefined || c[1] === column));
  if (table === "transactions") {
    if (select === "transaction_type, amount") return "summary";
    if (select === "transaction_at, transaction_type, amount") return "trend";
    if (select === "category_id, amount") {
      return has("in", "category_id") ? "budgetSpending" : "expenseByCategory";
    }
  }
  if (table === "categories") return has("or") ? "categoryNames" : "budgetCategoryNames";
  if (table === "budgets") return "budget";
  if (table === "budget_items") return "budgetItems";
  return `unknown:${table}`;
}

function fakeSupabase(route: Route) {
  const queries: Query[] = [];
  const client = {
    from(table: string) {
      const query: Query = { table, calls: [], kind: "" };
      queries.push(query);
      const run = () => {
        query.kind = kindOf(table, query.calls);
        query.startedAt = performance.now();
        const reply = route(query);
        const delayMs = "delayMs" in reply ? reply.delayMs : 0;
        const result = "delayMs" in reply ? reply.result : reply;
        return new Promise<QueryResult>((resolve, reject) =>
          setTimeout(() => {
            query.settledAt = performance.now();
            if (result instanceof Error) reject(result);
            else resolve(result);
          }, delayMs),
        );
      };
      const builder = {
        then<A, B>(
          onFulfilled?: (value: QueryResult) => A | PromiseLike<A>,
          onRejected?: (reason: unknown) => B | PromiseLike<B>,
        ) {
          return run().then(onFulfilled, onRejected);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "gte", "lt", "in", "or", "order", "maybeSingle"]) {
        builder[method] = (...args: unknown[]) => {
          query.calls.push([method, ...args]);
          return builder;
        };
      }
      return builder;
    },
  };
  const of = (kind: string) => queries.filter((q) => q.kind === kind);
  return { client, queries, of };
}

const ok = (data: unknown, delayMs = 0): Reply => ({ delayMs, result: { data, error: null } });
const fail = (message: string): Reply => ({ data: null, error: { message } });

// ---------------------------------------------------------------------------
// Demo data for October 2026. Amounts are whole rupiah.

const USER = "user-1";
const MONTH = "2026-10";

const SUMMARY_ROWS = [
  { transaction_type: "income", amount: 5_000_000 },
  { transaction_type: "expense", amount: 1_250_000 },
  { transaction_type: "expense", amount: 750_000 },
  // Excluded from income and expense.
  { transaction_type: "transfer", amount: 300_000 },
  // Skipped: not a finite number.
  { transaction_type: "expense", amount: "not-a-number" },
];
const EXPENSE_BY_CATEGORY_ROWS = [
  { category_id: "food", amount: 1_250_000 },
  { category_id: null, amount: 750_000 },
];
const CATEGORY_NAMES = [{ id: "food", name: "Makan" }];
const TREND_ROWS = [
  { transaction_at: "2026-10-05T00:00:00+00:00", transaction_type: "income", amount: 5_000_000 },
  { transaction_at: "2026-10-10T00:00:00+00:00", transaction_type: "expense", amount: 2_000_000 },
  { transaction_at: "2026-09-01T00:00:00+00:00", transaction_type: "expense", amount: 100_000 },
  { transaction_at: "2026-05-31T23:59:59+00:00", transaction_type: "income", amount: 1 },
  { transaction_at: "2026-08-15T00:00:00+00:00", transaction_type: "transfer", amount: 999_999 },
];
const BUDGET = { id: "budget-1", user_id: USER, month: "2026-10-01" };
const BUDGET_ITEMS = [
  { id: "i1", budget_id: "budget-1", category_id: "food", planned_amount: 1_000_000 },
  { id: "i2", budget_id: "budget-1", category_id: "transport", planned_amount: 500_000 },
  // Duplicate category: the first item for "food" wins.
  { id: "i3", budget_id: "budget-1", category_id: "food", planned_amount: 9 },
];
const BUDGET_CATEGORY_NAMES = [
  { id: "food", name: "Makan" },
  { id: "transport", name: "Transportasi" },
];
const BUDGET_SPENDING_ROWS = [
  { category_id: "food", amount: 1_000_000 },
  { category_id: "food", amount: 250_000 },
  { category_id: "transport", amount: 200_000 },
];

const DATA: Record<string, unknown> = {
  summary: SUMMARY_ROWS,
  expenseByCategory: EXPENSE_BY_CATEGORY_ROWS,
  categoryNames: CATEGORY_NAMES,
  trend: TREND_ROWS,
  budget: BUDGET,
  budgetItems: BUDGET_ITEMS,
  budgetCategoryNames: BUDGET_CATEGORY_NAMES,
  budgetSpending: BUDGET_SPENDING_ROWS,
};

// Every query succeeds with DATA, except the kinds overridden here.
function routeWith(overrides: Record<string, Reply> = {}, delayMs = 0): Route {
  return (query) => overrides[query.kind] ?? ok(DATA[query.kind], delayMs);
}

const EXPECTED_SUMMARY = { income: 5_000_000, expense: 2_000_000, incomplete: false };
const EXPECTED_CATEGORIES = {
  data: [
    { name: "Makan", amount: 1_250_000, percent: 62.5, colorIndex: 0 },
    { name: "Tanpa kategori", amount: 750_000, percent: 37.5, colorIndex: 1 },
  ],
  incomplete: false,
};
const EXPECTED_TREND = {
  points: [
    { month: "2026-05", label: "Mei", income: 1, expense: 0 },
    { month: "2026-06", label: "Jun", income: 0, expense: 0 },
    { month: "2026-07", label: "Jul", income: 0, expense: 0 },
    { month: "2026-08", label: "Agu", income: 0, expense: 0 },
    { month: "2026-09", label: "Sep", income: 0, expense: 100_000 },
    { month: "2026-10", label: "Okt", income: 5_000_000, expense: 2_000_000 },
  ],
  incomplete: false,
};
const EXPECTED_BUDGET = {
  rows: [
    {
      categoryName: "Makan",
      planned: 1_000_000,
      spent: 1_250_000,
      remaining: -250_000,
      isOverBudget: true,
      barPercent: 100,
    },
    {
      categoryName: "Transportasi",
      planned: 500_000,
      spent: 200_000,
      remaining: 300_000,
      isOverBudget: false,
      barPercent: 40,
    },
  ],
  exists: true,
  incomplete: false,
};
const NO_BUDGET = { rows: [], exists: false, incomplete: false };

// ---------------------------------------------------------------------------

describe("loadReportSections", () => {
  test("success: exact summary, category, trend, and budget figures", async () => {
    const db = fakeSupabase(routeWith());
    const result = await loadReportSections(db.client, USER, MONTH);

    assert.deepEqual(result.summary, EXPECTED_SUMMARY);
    assert.deepEqual(result.categories, EXPECTED_CATEGORIES);
    assert.deepEqual(result.trend, EXPECTED_TREND);
    assert.deepEqual(result.budget, EXPECTED_BUDGET);
  });

  test("every query keeps its table, columns, filters, date bounds, and order", async () => {
    const db = fakeSupabase(routeWith());
    await loadReportSections(db.client, USER, MONTH);

    const calls = Object.fromEntries(db.queries.map((q) => [q.kind, [q.table, ...q.calls]]));
    const MONTH_START = "2026-10-01T00:00:00.000Z";
    const MONTH_END = "2026-11-01T00:00:00.000Z";
    assert.deepEqual(calls, {
      summary: [
        "transactions",
        ["select", "transaction_type, amount"],
        ["eq", "user_id", USER],
        ["gte", "transaction_at", MONTH_START],
        ["lt", "transaction_at", MONTH_END],
      ],
      expenseByCategory: [
        "transactions",
        ["select", "category_id, amount"],
        ["eq", "user_id", USER],
        ["eq", "transaction_type", "expense"],
        ["gte", "transaction_at", MONTH_START],
        ["lt", "transaction_at", MONTH_END],
      ],
      categoryNames: [
        "categories",
        ["select", "id, name"],
        ["in", "id", ["food"]],
        ["or", `user_id.eq.${USER},user_id.is.null`],
      ],
      trend: [
        "transactions",
        ["select", "transaction_at, transaction_type, amount"],
        ["eq", "user_id", USER],
        ["gte", "transaction_at", "2026-05-01T00:00:00.000Z"],
        ["lt", "transaction_at", MONTH_END],
      ],
      budget: [
        "budgets",
        ["select", "*"],
        ["eq", "user_id", USER],
        ["eq", "month", "2026-10-01"],
        ["maybeSingle"],
      ],
      budgetItems: [
        "budget_items",
        ["select", "*"],
        ["eq", "user_id", USER],
        ["eq", "budget_id", "budget-1"],
        ["order", "created_at", { ascending: true }],
      ],
      budgetCategoryNames: [
        "categories",
        ["select", "id, name"],
        ["in", "id", ["food", "transport"]],
      ],
      budgetSpending: [
        "transactions",
        ["select", "category_id, amount"],
        ["eq", "user_id", USER],
        ["eq", "transaction_type", "expense"],
        ["gte", "transaction_at", MONTH_START],
        ["lt", "transaction_at", MONTH_END],
        ["in", "category_id", ["food", "transport"]],
      ],
    });
    assert.equal(db.queries.length, 8);
  });

  test("the four sections start together; dependencies inside a section still wait", async () => {
    const db = fakeSupabase(routeWith({}, 40));
    await loadReportSections(db.client, USER, MONTH);
    const one = (kind: string) => db.of(kind)[0];

    // Each section's first query starts before any of them finishes.
    const firsts = ["summary", "expenseByCategory", "trend", "budget"].map(one);
    const firstSettled = Math.min(...firsts.map((q) => q.settledAt!));
    for (const q of firsts) assert.ok(q.startedAt! < firstSettled, `${q.kind} started late`);

    // Names wait for the expense breakdown; items wait for the budget.
    assert.ok(one("categoryNames").startedAt! >= one("expenseByCategory").settledAt!);
    assert.ok(one("budgetItems").startedAt! >= one("budget").settledAt!);

    // Budget names and spending wait for the items, then run together.
    const names = one("budgetCategoryNames");
    const spending = one("budgetSpending");
    assert.ok(names.startedAt! >= one("budgetItems").settledAt!);
    assert.ok(spending.startedAt! >= one("budgetItems").settledAt!);
    assert.ok(names.startedAt! < spending.settledAt! && spending.startedAt! < names.settledAt!);
  });

  test("missing budget: the budget section is empty, not incomplete", async () => {
    const db = fakeSupabase(routeWith({ budget: ok(null) }));
    const result = await loadReportSections(db.client, USER, MONTH);

    assert.deepEqual(result.budget, NO_BUDGET);
    assert.equal(db.of("budgetItems").length, 0);
    assert.deepEqual(result.summary, EXPECTED_SUMMARY);
  });

  test("a failed budget lookup still reads as no budget, as before", async () => {
    const db = fakeSupabase(routeWith({ budget: fail("timeout") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.budget, NO_BUDGET);
  });

  test("budget without items: no rows, no name or spending lookup", async () => {
    const db = fakeSupabase(routeWith({ budgetItems: ok([]) }));
    const result = await loadReportSections(db.client, USER, MONTH);

    assert.deepEqual(result.budget, { rows: [], exists: true, incomplete: false });
    assert.equal(db.of("budgetCategoryNames").length, 0);
    assert.equal(db.of("budgetSpending").length, 0);
  });

  test("month without expenses: empty breakdown, no name lookup", async () => {
    const db = fakeSupabase(routeWith({ expenseByCategory: ok([]) }));
    const result = await loadReportSections(db.client, USER, MONTH);

    assert.deepEqual(result.categories, { data: [], incomplete: false });
    assert.equal(db.of("categoryNames").length, 0);
  });

  const others = (result: ReportSections, skip: keyof ReportSections) => {
    const expected: Record<keyof ReportSections, unknown> = {
      summary: EXPECTED_SUMMARY,
      categories: EXPECTED_CATEGORIES,
      trend: EXPECTED_TREND,
      budget: EXPECTED_BUDGET,
    };
    for (const key of Object.keys(expected) as (keyof ReportSections)[]) {
      if (key !== skip) assert.deepEqual(result[key], expected[key], `${key} changed`);
    }
  };

  test("summary failure marks only the summary incomplete", async () => {
    const db = fakeSupabase(routeWith({ summary: fail("down") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.summary, { income: 0, expense: 0, incomplete: true });
    others(result, "summary");
  });

  test("category breakdown failure marks only that section incomplete", async () => {
    const db = fakeSupabase(routeWith({ expenseByCategory: fail("down") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.categories, { data: [], incomplete: true });
    assert.equal(db.of("categoryNames").length, 0);
    others(result, "categories");
  });

  test("category-name failure keeps the amounts and the generic label, as before", async () => {
    const db = fakeSupabase(routeWith({ categoryNames: fail("down") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.categories, {
      data: [
        { name: "Kategori lain", amount: 1_250_000, percent: 62.5, colorIndex: 0 },
        { name: "Tanpa kategori", amount: 750_000, percent: 37.5, colorIndex: 1 },
      ],
      incomplete: false,
    });
    others(result, "categories");
  });

  test("trend failure marks only the trend incomplete", async () => {
    const db = fakeSupabase(routeWith({ trend: fail("down") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.trend, { points: [], incomplete: true });
    others(result, "trend");
  });

  test("budget-spending failure marks the whole budget section incomplete, never zero spending", async () => {
    const db = fakeSupabase(routeWith({ budgetSpending: fail("statement timeout") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.budget, { rows: [], exists: true, incomplete: true });
    others(result, "budget");
  });

  test("a budget-spending request that throws behaves the same", async () => {
    const db = fakeSupabase(routeWith({ budgetSpending: new Error("fetch failed") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.budget, { rows: [], exists: true, incomplete: true });
    others(result, "budget");
  });

  test("budget-name failure keeps the rows with the generic label, as before", async () => {
    const db = fakeSupabase(routeWith({ budgetCategoryNames: fail("down") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(
      result.budget.rows.map((r) => [r.categoryName, r.spent]),
      [
        ["Kategori", 1_250_000],
        ["Kategori", 200_000],
      ],
    );
    assert.equal(result.budget.incomplete, false);
  });

  test("a budget-name request that throws marks the budget incomplete, as before", async () => {
    const db = fakeSupabase(routeWith({ budgetCategoryNames: new Error("fetch failed") }));
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(result.budget, { rows: [], exists: true, incomplete: true });
    others(result, "budget");
  });

  test("a thrown request in one section does not reject the others", async () => {
    const db = fakeSupabase(
      routeWith({ summary: new Error("fetch failed"), trend: new Error("fetch failed") }),
    );
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.equal(result.summary.incomplete, true);
    assert.equal(result.trend.incomplete, true);
    assert.deepEqual(result.categories, EXPECTED_CATEGORIES);
    assert.deepEqual(result.budget, EXPECTED_BUDGET);
  });

  test("every section failing at once still resolves", async () => {
    const db = fakeSupabase(
      routeWith({
        summary: fail("down"),
        expenseByCategory: fail("down"),
        trend: fail("down"),
        budgetSpending: fail("down"),
      }),
    );
    const result = await loadReportSections(db.client, USER, MONTH);
    assert.deepEqual(
      [result.summary, result.categories, result.trend, result.budget].map((s) => s.incomplete),
      [true, true, true, true],
    );
  });
});
