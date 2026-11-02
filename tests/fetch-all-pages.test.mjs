import assert from "node:assert/strict";
import test from "node:test";
import { fetchAllPages } from "../lib/supabase/fetch-all-pages.ts";

test("reads every ledger row past 1,000", async () => {
  const source = Array.from({ length: 1207 }, (_, index) => ({ id: index + 1, amount: 1 }));
  const actual = await fetchAllPages(async (from, to) => ({
    data: source.slice(from, to + 1),
    error: null,
  }));
  assert.equal(actual.length, 1207);
  assert.equal(actual.reduce((sum, row) => sum + row.amount, 0), 1207);
  assert.equal(actual.at(-1).id, 1207);
});

test("handles exactly one full page and then stops", async () => {
  const source = Array.from({ length: 500 }, (_, id) => ({ id }));
  let calls = 0;
  const actual = await fetchAllPages(async (from, to) => {
    calls += 1;
    return { data: source.slice(from, to + 1), error: null };
  });
  assert.equal(actual.length, 500);
  assert.equal(calls, 2);
});

test("rejects an error on a later page instead of displaying incomplete totals", async () => {
  await assert.rejects(
    fetchAllPages(async (from) =>
      from === 0
        ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
        : { data: null, error: { message: "network failure" } },
    ),
    /network failure/,
  );
});

for (const count of [0, 1, 499, 500, 501, 999, 1000, 1001, 2026]) {
  test(`pagination returns exactly ${count} rows, without truncation or duplication`, async () => {
    const source = Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      amount: index % 2 === 0 ? 100 : -50,
    }));
    const requests = [];
    const result = await fetchAllPages(async (from, to) => {
      requests.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    });
    assert.deepEqual(result, source);
    assert.equal(result.reduce((sum, row) => sum + row.amount, 0),
      source.reduce((sum, row) => sum + row.amount, 0));
    assert.ok(requests.every(([from, to]) => to - from + 1 === 500));
    assert.equal(requests.length, Math.floor(count / 500) + 1);
  });
}

test("rejects a null page rather than returning a fabricated zero balance", async () => {
  await assert.rejects(fetchAllPages(async () => ({
    data: null,
    error: null,
  })), /returned no data/);
});

test("returns an empty ledger only when an empty page is actually returned", async () => {
  const rows = await fetchAllPages(async () => ({ data: [], error: null }));
  assert.deepEqual(rows, []);
});
