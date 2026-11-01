# Report: parallel report sections on /reports (2026-11-01)

## Change

`app/(app)/reports/page.tsx` only, for app behavior:

- Each of the four sections moved, line for line, into its own module-private async loader: `loadSummarySection`, `loadCategorySection`, `loadTrendSection`, `loadBudgetSection`. Each keeps its original try/catch and returns its own `incomplete` flag (and `exists` for the budget).
- `loadReportSections` starts the four with `Promise.all` after `getUser()`. No loader can reject, so one failing section never cancels or hides another.
- In the budget section, the category-name lookup and `computeCategorySpending` run together with `Promise.all`. An error from either still reaches the section's catch, so a failed spending query marks the whole budget section incomplete, as before. No zero-spending substitute.
- Unchanged: the session check, month resolution, every query (tables, columns, filters, date bounds, order), the de-duplication, all money math and helpers, sorting, labels, the rendered JSX, empty states, and notices. Verified with a diff:
  - The `ReportsContent` JSX (83 lines) and the four helper components are byte-identical to HEAD.
  - All 35 query and money lines match HEAD apart from indentation, `user.id` to `userId`, and the one `computeCategorySpending` call now inside `Promise.all`.
- `/budget` patch untouched.

Test support:

- `tests/setup/register.mjs` now compiles `.tsx` with the project's TypeScript 5.9.3 (already installed) and resolves `next/server`-style imports.
- It also supports `?expose=name` imports. Next.js page files may only export `default` and route config (checked by the generated `.next/types/.../page.ts`), so the loaders stay unexported in source. Tests reach them through an export added to the test copy of the module.
- `tests/reports.test.ts`: 17 tests.

## Dependencies

- `getUser` before everything.
- Inside the category section, names after the expense breakdown.
- Inside the budget section: items after the budget, then names and spending (together) after the items.
- The four sections are independent of each other.

## Checks

- `npm test`: 28/28 pass (11 budget, 17 reports). The report tests cover:
  - exact income, expense, category amounts and percentages, the six trend points, and the budget rows;
  - every query's table, columns, filters, date bounds, and order;
  - concurrency of the four sections, plus the order of the dependencies inside sections;
  - missing budget, failed budget lookup (still reads as no budget, as before), budget without items, and month without expenses;
  - each section failing alone with the others unchanged;
  - budget-spending error or throw marking the whole budget section incomplete;
  - name failures keeping the generic labels;
  - thrown requests not rejecting other sections, and all sections failing at once.
- Mutation checks, each restored afterwards and compared with the saved copy:
  - Making the four sections sequential fails the concurrency test.
  - Replacing a failed spending query with zero spending fails three tests.
- `npm run lint`: exit 0.
- `npm run build` with the dev server stopped: exit 0. Route markers unchanged (6 static, 21 partial prerender, 10 dynamic); `/reports` and `/budget` stay partial prerender.
- `git diff --check`: clean for tracked changes and new files.

## Timing

Before (from the earlier analysis): 5 signed-in loads of `/reports?month=2026-10` on `next dev`. Median total 2.1 s; median Supabase wait 1,909 ms; 9 calls, all sequential.

After: not measured yet. It needs 5 signed-in loads, and this environment has no session. The dev server runs with the same timing hook (now at `.next/cache/kiro-perf/fetch-timing.mjs`, because `next build` clears other `.next` folders).

## Follow-up: measured after the change (2026-11-01)

Source: the `next dev` log with the timing hook, signed-in loads by the user of `/reports?month=2026-10` (the URL also carried `utm_source`, which the page ignores). The log shows 7 loads:
- #2: cold compilation, 6.3 s. Excluded.
- #3: 1,225 ms, an early load. Excluded.
- #4 to #8: the last five, analyzed below.

These are development-server measurements on this machine (Supabase `ap-southeast-2`), not a production benchmark.

| Load | Total | Supabase wait (first start to last end) | Sum of call times | Max concurrent |
|---|---|---|---|---|
| #4 | 930 ms | 845 ms | 1,894 ms | 4 |
| #5 | 944 ms | 834 ms | 1,872 ms | 4 |
| #6 | 936 ms | 833 ms | 1,894 ms | 4 |
| #7 | 1,084 ms | 943 ms | 2,372 ms | 4 |
| #8 | 974 ms | 877 ms | 1,934 ms | 4 |
| Median | **944 ms** | **845 ms** | | |

Before and after:
- Total: median 2.1 s before (the log rounds values of 2 s and up to 0.1 s), 944 ms after. Saving about 1,156 ms (1,106 to 1,206 ms given the rounding), about 55%.
- Supabase wait: median 1,909 ms before, 845 ms after. Saving 1,064 ms; the earlier estimate was 1,056 ms.

Shape of each load, 9 calls in 4 steps:
1. `auth/v1/user` alone.
2. The four section queries together (4 concurrent).
3. Category names alongside budget items (2 concurrent).
4. Budget names and budget spending together (2 concurrent).

No new connections were opened in these five loads. Individual calls stayed at about 200 to 230 ms, except in #7, where three calls took 299 to 499 ms.

Critical path: `getUser` → budgets → budget_items → budget names / budget spending. In #7, the category-name lookup (499 ms) finished at the same time as that chain.

Errors and incomplete sections: every call returned 200, none threw, and the log has no error lines. No section can be incomplete, because incomplete flags are set only on errors.

Calculation inputs:
- Every load made the same 9 queries (same columns and filter names) as the baseline.
- Each query returned the same row count and byte size as before (466, 607, 297, 969, 250, 353, 74, and 75 B).
- The calculation code is unchanged.
- The figures on screen were not seen in this environment.

Decision: the saving clears the 300 ms target. Production impact is still unmeasured.

## Commit preparation (branch `perf/reports-parallel`)

This commit holds only the `/reports` change. The `/budget` work (`app/(app)/budget/page.tsx`, `lib/budgets.ts`, `tests/budgets.test.ts`, and its report) stays uncommitted in the working tree. The "28/28" above was the combined run; this commit contains the 17 report tests.

Isolated check: the staged files were exported with `git checkout-index` into an ignored folder, with `node_modules` linked and no `.env.local`. In that tree `lib/budgets.ts` and the budget page equal HEAD.
- `npm test`: 17/17 pass.
- `eslint .`: exit 0.
- `tsc --noEmit`: exit 0.
- `next build --webpack`: exit 0. Route markers 6 static, 21 partial prerender, 10 dynamic; `/reports` and `/budget` stay partial prerender. Next warned that it found two lockfiles; that only applies to the nested copy.
