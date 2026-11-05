# Phase 1: financial integrity and regression audit (2026-11-05)

Branch `audit/kiro-financial-integrity`, based on `origin/main` at `e9e4ff9` (Merge PR #29).

## Method and limits

- Code: read on that commit only (transactions, accounts, recurring, backup, restore, cron, SQL in `docs/sql`, tests).
- Database: read-only queries on production (`zvmqrrttdrqkyrdzyxlf`) through the read-only MCP role:
  - RLS flags and policies, constraints, triggers, function grants, and `cron.job`;
  - aggregate counts only (no row contents);
  - date arithmetic on constants.

  No writes, no schema changes, no destructive SQL. No secrets read.
- Not available:
  - no local PostgreSQL or Docker, so the SQL integration tests (`tests/sql/*`) were not run here (CI runs them);
  - no signed-in session, so no live UI reproduction;
  - no `gh` CLI or GitHub token, so no draft pull request.
- Production data today: 1 user, 12 transactions, 0 fractional amounts, 0 invalid transfers, 0 monthly templates on day 29 to 31. None of the findings below has corrupted existing data.

## Summary

| ID | Severity | Area | Finding |
|---|---|---|---|
| F-01 | High | Recurring | Monthly schedules on day 29, 30, or 31 drift to the 28th permanently after February |
| F-02 | High | Accounts | "E-wallet" and "Tabungan" accounts cannot be created: the DB constraint rejects `e_wallet` and `savings` |
| F-03 | Medium | Transactions | Editing a transaction rewrites `source`/`source_reference` to manual/null |
| F-04 | Medium | Transactions | Amount rules differ: server action has no integer or upper bound; create RPC allows 1e17 (above 2^53), restore allows 1e12 |
| F-05 | Medium | Recurring | "Catat sekarang" can post future occurrences ahead of time, and rewinding `next_due_date` can duplicate the first occurrence |
| F-06 | Medium (latent) | Transactions | The ledger list query has no paging; `?month=all` stops at the PostgREST row cap |
| F-07 | Low | Transactions | Update and delete return success when no row matched |
| F-08 | Low | Backup | Backup cron has no once-per-day guard and no retention; backup UI was removed in PR #30, so cron failures are invisible |
| F-09 | Low | Docs/copy | Recovery SQL says "NOT APPLIED TO PRODUCTION" but is live; delete dialog says the action cannot be undone |
| F-10 | Low | Accounts | Opening balance cannot be negative, so existing credit-card debt cannot be entered |
| F-11 | Low | Backup | Manual backup size check uses pretty JSON, storage uses compact JSON |

No Critical finding: no defect found that changes stored amounts, mixes users' data, or loses data.

## Findings

### F-01 High: monthly recurrence drifts after a short month

- Files:
  - `docs/sql/2026-11-p0-atomic-recurring.sql` (`generate_recurring_now`): `WHEN 'monthly' THEN v_next := (v_due + make_interval(months => v_template.interval_count))::date;`.
  - `docs/sql/2026-11-p0-create-transaction-recurring-atomic.sql`: `(p_transaction_date + interval '1 month')::date`.
  - The JS mirror `computeNextDueDate` in `lib/recurring.ts` has the same shape but has no callers on `main`.
- Cause: the next date is computed from the previous, already clamped due date instead of the schedule's start day.
- Evidence (PostgreSQL date arithmetic on constants, run read-only on production):
  - `2026-01-31 + 1 month` = `2026-02-28`
  - `2026-02-28 + 1 month` = `2026-03-28` (expected `2026-03-31`)
  - `2026-01-30` chained twice = `2026-03-28`
- Existing coverage: `tests/sql/recurring-integration.sql` checks only the first clamp (`2026-02-28`).
- Reproduce (disposable DB): run `recurring-fixture.sql`, `2026-11-p0-atomic-recurring.sql`, `recurring-integration.sql`, then the new `tests/sql/recurring-month-end-anchor.sql`. It raises `F-01 monthly drift: next_due_date is 2026-03-28`.
- Impact: salaries, rent, or bills scheduled on the 29th to 31st are recorded on the 28th from March on, which can move them into the wrong week and changes due-date reminders. Production has 0 affected templates today.

### F-02 High: two account types are rejected by the database

- Files: `lib/accounts.ts:88-100` offers `cash, bank, e_wallet, credit_card, savings, investment`. `components/finance/account-form.tsx:162` renders all of them.
- Live constraint `accounts_account_type_check`: `account_type = ANY (ARRAY['bank','cash','ewallet','credit_card','investment','other'])`.
- `e_wallet` and `savings` are not in the list (the DB spells it `ewallet` and has no savings type). The constraint is not in `docs/sql`.
- Reproduce: Rekening, then Tambah rekening, then Jenis "E-wallet" (or "Tabungan"), then Simpan. The insert violates the CHECK, and `createAccount` shows "Rekening gagal disimpan. Silakan coba lagi." The same applies to changing an existing account to either type.
- Not executed against production (no writes allowed). This follows directly from the constraint definition plus the insert payload `account_type: input.account_type`.
- Production has 0 accounts of these types, consistent with every attempt failing.

### F-03 Medium: edit rewrites provenance

- File: `app/(app)/transactions/actions.ts`. `buildPayload` (line 249) always sets `source: "manual", source_reference: null` (lines 265-266), and `updateTransaction` writes it (line 367).
- Effects:
  - A Gmail import becomes a manual row. `app/(app)/settings/gmail/actions.ts:141-148` looks up `source = 'email'` plus the message id, so the edited import reads as "missing". A re-import is then possible; the full re-import path was not traced, so a duplicate is suspected, not confirmed.
  - A recurring occurrence (`source = 'recurring'`, reference `<template>:<date>`) loses the reference that the unique index `transactions_source_reference_uidx` uses to block a second posting of the same date.
  - The first occurrence created with a recurring schedule (`initial-recurring:<key>`) loses its retry-idempotency link.
- Reproduce: import a Gmail draft, edit its note, and save. The row now has `source = 'manual'`.

### F-04 Medium: amount rules differ between layers

- `validate()` in `app/(app)/transactions/actions.ts` checks only finite and greater than 0. It has no integer check and no maximum. The form enforces safe integers, but a direct server-action call with `12.5` or `1e300` passes and is inserted. The DB only checks `amount > 0`.
- The create RPC allows `p_amount <= 1e17`, which is above `Number.MAX_SAFE_INTEGER` (about 9.007e15). Balances fold with `Number(...)`, so Rp9.007.199.254.740.993 becomes ...992 (tested).
- Restore allows at most 1e12, integer only (`smart-restore-system-category-fix.sql:56`, `smart-restore-plan.mjs:68`). A transaction between Rp1 trillion and the create cap can be created but never restored.
- Production: 0 fractional amounts today.

### F-05 Medium: recurring posting ahead of time and duplicate first occurrence

- `generate_recurring_now` never compares the due date with today. Repeated "Catat sekarang" clicks (one per page load) post next month, then the month after. Balances count all rows with no date cutoff (`lib/accounts.ts`), so future occurrences lower today's balance. It is not clear whether this is intended, so it needs a product decision.
- `updateRecurring` accepts any `next_due_date` from the form (`components/finance/recurring-form.tsx:319` falls back to `startDate`). The first occurrence created with a schedule has the reference `initial-recurring:<key>`, not `<template>:<date>`. Moving the next due date back to the start date and clicking "Catat sekarang" therefore inserts a second row for that date instead of being rejected by the unique index.
- Not reproduced in a database here (no local PostgreSQL). Both follow from the function bodies quoted in the files above.

### F-06 Medium (latent): ledger list without paging

- `buildTransactionListQuery` (`lib/transactions.ts:150-210`), awaited at `app/(app)/transactions/page.tsx:131`, has no `.range()`. Supabase returns at most 1000 rows by default without an error, so `?month=all` (or a month with more than 1000 rows) silently shows a shortened list.
- The month totals use the paginated `computeMonthIncomeExpense`, so the summary stays right while the list can be incomplete.
- Production has 12 transactions, so nothing is affected today.

### F-07 Low: update and delete report success for 0 rows

- `updateTransaction` and `deleteTransaction` do not read back the affected rows. A deleted or foreign id returns `{ ok: true }`, for example when an edit form was left open and the row was deleted in another tab. RLS and the `user_id` filter prevent any cross-user write, so this only affects user feedback.

### F-08 Low: backup cron and visibility

- `app/api/cron/backup/route.ts` processes every auth user on every run, with no `last_backup_at` check. A retried or duplicated invocation stores another full snapshot per user.
- Snapshots are never deleted. History lists only the newest 100.
- Since PR #30, `BackupControls` and `RestorePreviewControls` are rendered nowhere (grep: no `<BackupControls`), and `tests/settings-simplification.test.mjs` asserts their removal. So this is intended. As a result, users cannot see whether the nightly backup failed, and the only restore entry is `/transactions/recover`.

### F-09 Low: documentation and copy drift

- `docs/sql/2026-11-production-deleted-transaction-recovery-30d.sql` line 1 says "NOT APPLIED TO PRODUCTION". Production has the trigger `budgetku_capture_deleted_transaction`, the function `capture_deleted_transaction_v1`, and the active pg_cron job `budgetku-purge-deleted-transactions-30d`.
- `components/transactions/row-actions-menu.tsx:39` says "Tindakan ini tidak bisa dibatalkan." Deleted transactions can be recovered for 30 days.

### F-10 Low: credit card opening balance

- `app/(app)/accounts/actions.ts` `validate` rejects `initial_balance < 0`, so an existing credit-card debt cannot be entered as the opening balance. This is a product limitation, not a calculation error.

### F-11 Low: backup size check mismatch

- `app/api/settings/backup/route.ts:33` measures `JSON.stringify(backup, null, 2)`, while `lib/settings/backup-storage.ts:29` stores `JSON.stringify(backup)`. A backup between the two sizes is refused with 413 although it would fit.

## Reviewed and found OK

- Deletes are hard deletes and every money query reads only `transactions`, so deleted rows never count. Every money total uses `fetchAllPages` with `.range()` and an order, and is scoped by `user_id` (now guarded by tests).
- Transfers: application, RPCs, and the DB CHECK `transactions_check` all require a destination different from the source. Balance math moves money once and keeps the total unchanged.
- Create, edit, and recurring check account and category ownership by `user_id` and non-archived state, in addition to RLS.
- Restore (journal and Smart Restore) is insert-only by original id, owner-checked in route, planner, and RPC, idempotent, and blocks archived or missing accounts and categories.
- Backup publication never deletes or overwrites a verified snapshot before the new one is read back.
- Storage paths are keyed by user id, with an owner-only storage policy and strict snapshot names.
- Cron routes require `Authorization: Bearer <CRON_SECRET>`, compared with `timingSafeEqual`. The service-role backup scopes every query by `user_id`.
- RLS is enabled on all 16 public tables, with owner policies. System categories and merchant rules are readable, not writable. `transaction_change_history` is owner select-only.
  - SECURITY DEFINER functions are not executable by `anon` or `authenticated`.
  - Two trigger functions (`set_updated_at`, `validate_budget_month`) are executable by `anon`. That is harmless for trigger functions, but could be revoked for hygiene.

## Tests added on this branch

`tests/financial-integrity-audit.test.mjs` runs with the existing `npm test`.

- 12 regression guards that pass today:
  - all five money totals page through every row and are user-scoped;
  - transfer total conservation;
  - transfer destination rules in each layer;
  - amounts within the restore cap stay exact;
  - the precision loss above 2^53, as evidence.
- 7 tests marked `todo` assert the correct behaviour for F-01, F-02, F-03, F-04 (two), F-06, and F-07. They fail today by design and are reported as todo, so the suite stays green. Remove each `todo` marker with its fix.

`tests/sql/recurring-month-end-anchor.sql`: SQL regression test for F-01, to run after the existing recurring fixture and integration test in a disposable database. It is expected to fail until F-01 is fixed, so it is not wired into CI yet. Not executed here (no local PostgreSQL).

## Missing regression tests

1. SQL: monthly schedules starting on the 29th, 30th, and 31st over at least 3 steps, and yearly from Feb 29 (F-01).
2. A contract test that `ACCOUNT_TYPES` matches the live `accounts_account_type_check`, plus a migration file in `docs/sql` that documents the constraint (F-02).
3. Unit tests for transaction `validate()` and `buildPayload()`. They are private to a `"use server"` file today and need extraction into `lib/` (F-03, F-04).
4. SQL: `generate_recurring_now` with a due date in the future, and after `next_due_date` is moved back onto the initial occurrence (F-05).
5. Ledger list with more than 1000 rows in `?month=all` (F-06).
6. Update and delete of a missing or foreign id (F-07).
7. SQL tests for `restore_selected_transactions_v1`: none exist in `tests/sql`.
8. Backup cron route: missing secret (503), wrong token (401), and a double run.
9. Backup consistency when a write lands between page reads (offset paging without a snapshot).

## Recommended fixes, by risk and user impact

1. **F-02**: align account types with the DB. Either map `e_wallet` to `ewallet` and drop or replace `savings` in `lib/accounts.ts`, or add a reviewed migration that extends the CHECK. App-only, small, unblocks users immediately.
2. **F-01**: compute monthly and yearly next dates from `start_date` plus the number of steps (clamped to the month's last day) in both SQL functions. Migration, test first with the new SQL test in staging.
3. **F-03**: do not write `source`/`source_reference` on update. Keep provenance from the stored row.
4. **F-04**: add `Number.isSafeInteger` and one shared maximum (for example 1e12, matching restore) to the server-side validation and both RPCs.
5. **F-05**: decide whether early posting is allowed. If not, reject `v_due > current_date` in `generate_recurring_now`. Validate that `next_due_date` is never earlier than the last recorded occurrence.
6. **F-06**: page the ledger list (load more), or cap and say so in the UI.
7. **F-07, F-08, F-09, F-10, F-11**: small follow-ups: check affected rows, add a daily guard and retention policy for backups, fix the doc header and delete copy, allow negative opening balances for credit cards, and use the same size measure.

## Commands run (on this branch)

| Command | Result |
|---|---|
| `npm test` (before adding tests, on `e9e4ff9`) | exit 0: 73 tests, 73 pass |
| `npm test` (with audit tests) | exit 0: 92 tests, 85 pass, 7 todo, 0 fail |
| `npm run lint` | exit 0, no warnings |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0; 6 static, 22 partial prerender, 17 dynamic routes |
| `tests/sql/*` | not run: no PostgreSQL available locally |
