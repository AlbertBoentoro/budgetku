> **ACTIVE P0 UPDATE — 2 Nov 2026 (supersedes all older status below):**
> - PR #4 and #7 are already merged; production Vercel serves Git SHA
>   `4ce5bf8c89d90e1d873409a65c6b7995c5670d6a`.
> - Atomic recurring RPC and goal-status migrations are already present in
>   production, verified via read-only inspection. No change to live data
>   or schema was performed during this follow-up.
> - Current work: protect the existing backup files, in
>   **fix/p0-preserve-legacy-backup-20261102**, draft PR
>   **https://github.com/AlbertBoentoro/budgetku/pull/13** (issue #8).
> - Read-only production Storage inventory: 2 existing `latest.json`
>   objects, **0 immutable snapshots**. Protecting these prior to first new
>   backup rotation is a release-blocking risk.
> - Branch PR #13 archives a validated existing latest file to a deterministic
>   immutable snapshot, verifies its checksum, then writes a new snapshot
>   before updating latest; rejects errors and changed latest baseline.
> - Full unit/SQL/lint/build CI: see PR #13 check summary for latest
>   SHA. Until green, do not call this production-ready.
> - Other in-progress *draft* PRs #9 (anonymous HTTP smoke), #10 (isolated
>   staging browser tests), #11 (staging-only atomic restore), and #12
>   (read-only/staging restore preview) are independent. Do NOT merge
>   any of them implicitly, or overwrite their branches.
> - **Standing approval gate:** user authorized independent branch-only
>   coding/tests. No production Storage change, Supabase migration, merge,
>   or production deployment without a fresh explicit user YES.
> - Codex: read root AGENTS.md, this note, PR #13 and the tests; continue
>   without asking the user to type context again.

> **LATEST STATUS (2026-11-02, supersedes historical notes below):** PR #4 was
> MERGED into main as `ac87534133c9cbffab23b2186388b505405a3756`.
> Three approved production Supabase migrations (recurring atomic RPC, goal
> status, goal contribution ownership) were applied successfully and verified.
> Vercel production at `budgetku-weld.vercel.app` was READY on that commit.
> Any earlier text below saying "not deployed" or "PR #4 draft" documents
> the older state, NOT the current live release.
>
> **ACTIVE WORK NOW:** branch `fix/p0-recovery-integrity-20261102`, draft
> [PR #7](https://github.com/AlbertBoentoro/budgetku/pull/7), starting from
> the deployed main commit. No new production change has been approved.
> - Store timestamped immutable backups; read back and verify SHA256/format/
>   ownership before updating `latest.json`.
> - Authenticated read-only backup history and inspection APIs; existing
>   latest download is validated.
> - Repair partial Gmail imports by linking an existing unique-source
>   transaction rather than trying to insert a duplicate.
> - All data is synthetic in branch tests, no live financial row changes.
> - **Full transactional restore is NOT implemented or tested yet.** Don't
>   claim the application is disaster-recovery-complete.
> - Deferred transaction form UI issue #5 and custom categories issue #6
>   remain postponed as requested.
>
> Production gate: user approval required again before merging this new PR,
> deploying, or modifying live schema. Run CI first and report actual results.

# Budgetku Phase 0 — handoff for ChatGPT / Codex / reviewers

Updated: 2026-11-02. This file is intentionally durable context so the user
does not have to repeat the conversation when switching tools.

## User's standing delegation

The user explicitly approved autonomous **Phase 0 financial integrity** work:
read/audit, edit source code on the existing isolated fix branch, add tests,
run checks, fix failures, document results, and prepare a draft PR.

The user wants a simple **YES / NO** decision, not manual technical steps.
**Do not execute live production database changes, merge into main, or deploy
to production without a new explicit approval.** Do not request repeated
approval for branch-only changes covered above. Never alter live financial data.

Read root AGENTS.md and .kiro/steering/budgetku-workflow.md first.
The user wants clear Indonesian summaries, in the form:
issue -> change -> user-facing effect -> test evidence -> approval needed.

## Project & work location

- Repository: AlbertBoentoro/budgetku
- Baseline main when branch created: d4cadb2106ee1d8ea6199f5ec0991b27987cdd03
- Fix branch: fix/financial-integrity-p0-20261101
- Draft PR: https://github.com/AlbertBoentoro/budgetku/pull/4
- Production Vercel hostname: budgetku-weld.vercel.app
- Production Supabase project: budgeting-app, Sydney region.
- No live SQL schema modification, release merge, or manual production deploy
  has been authorized.
- Vercel might automatically create a *preview* for PR activity; that is
  not permission to promote or deploy to production.

## Verified diagnostic findings (read-only)

1. public.transactions CHECK on source allows manual/email/receipt/screenshot/
   statement/import/ai but **not 'recurring'**. Existing recurring button writes
   that value and thus fails.
2. Recurring button used two independent operations: transaction INSERT followed
   by recurring next_due_date UPDATE. Needs one atomic transaction and
   concurrent request protection.
3. Ledger-backed balances and several summary aggregations selected unpaged
   rows; PostgREST row-limit truncation can create inaccurate totals.
4. sumRunningAccountBalances ignored accounts.include_in_total despite this
   setting existing in database.
5. Goal contributions are progress records and do not automatically move
   money between accounts; decide intended UX explicitly. Do not silently
   inject additional transactions or change existing balances.
6. Existing backup export uses paginated reads; restore is not implemented.
7. Security adviser observed RLS on checked financial tables, with an auth
   leaked-password setting warning. Performance adviser found missing FK
   indexes and auth.uid() evaluation overhead (not necessarily security holes).

Read-only live counts at inspection: 10 transactions, 1 recurring template,
0 'recurring' ledger rows. Avoid logging real customer row data.

## Staged changes on branch (NEED CI AND STAGING VERIFICATION)

- lib/supabase/fetch-all-pages.ts: 500-row bounded fetch helper.
- lib/accounts.ts, lib/budgets.ts, lib/transactions.ts, lib/reports.ts:
  paginate aggregate reads; respect excluded accounts.
- docs/sql/2026-11-p0-atomic-recurring.sql:
  **staged migration only**, changes CHECK and adds invoker-context
  public.generate_recurring_now(p_template_id uuid) SQL function with
  FOR UPDATE lock, per-occurrence reference and atomic insert + schedule.
- app/(app)/recurring/actions.ts: now calls that RPC.
- lib/supabase/database.types.ts: staged RPC signature.
- tests/fetch-all-pages.test.mjs and package.json: Node regression tests.
- .github/workflows/financial-integrity-ci.yml: unattended PR CI to run
  npm ci, npm test, lint, build, and TypeScript check; PUBLIC placeholder
  env values only, no production financial data or service role key.

## Required automated validation and fixes before approval gate

1. Observe the GitHub Actions job attached to PR #4; fix every failure on
   the isolated branch and re-run until all checks pass.
2. Expand unit tests to cover 0, 1, 499, 500, 501, 999, 1000, 1001, >1001,
   failing later pages, and transfer/source/destination balance math.
3. Run lint, compile and typecheck. Review UI consistency of the recurring
   action if behavior changes. No visual PASS without actual browser evidence.
4. Test SQL migration and generation RPC in a **separate staging DB**.
   Verify authenticated user isolation, concurrent clicks, unique refs,
   missing category/account, end-date, month-end, failure rollback, and
   expected auto_create behavior. **Do not test write RPC against production.**
5. Review accounting rules for transfers, liabilities, excluded accounts,
   goals, and backup restoration. Add tests and staging fixture data.
6. Verify transaction import idempotence and RLS for multiple users in staging.
7. Record exactly which checks passed, which are blocked, and what still
   needs approval. Never claim production E2E tests passed from unit tests.
8. Do not merge PR or apply SQL to production until user gives a new YES.

## Handoff command for Codex (one line if needed)

'Continue Budgetku Phase 0 autonomously from docs/phase0-handoff.md and
AGENTS.md on branch fix/financial-integrity-p0-20261101.
Run/fix all automated checks; report results in Indonesian; request explicit
approval before any production DB migration, merge, or production deployment.'

Important: Codex does not automatically inherit all text from the original
ChatGPT conversation. These repository files are the shared context. Do not
assume that account integrations or secret credentials automatically transfer
between tools; require authorized access or an isolated staging environment.

## Latest user scheduling: DEFER transaction form UI and categories

On Nov 2 user supplied 3 screenshots showing the Add Transaction form on
localhost and explicitly requested these improvements be recorded but NOT
implemented until P0/P1 and subsequent priority work is finished.
- GitHub issue #5: https://github.com/AlbertBoentoro/budgetku/issues/5
  Numeric-only keyboard/state (no letters), 4-digit thousand grouping,
  merge big Rp prefix next to big number, remove redundant small amount
  display, clear stale invalid text once a positive number is entered,
  improve right inset around select/dropdown indicators, mobile visual tests.
- GitHub issue #6: https://github.com/AlbertBoentoro/budgetku/issues/6
  Custom user-owned category create/edit/archive/select, respecting RLS.
Do not implement issues #5/#6 in the active P0 branch; keep them in backlog.

## 2026-11-02 additional P0 findings and staged changes

- Production financial_goals.status CHECK allows active, paused, completed,
  cancelled; application writes active, achieved, archived. This creates a
  deterministic failure for achieved/archived updates. STAGED SQL
  `docs/sql/2026-11-p0-goal-status.sql` adds achieved and archived while
  preserving existing values. It has NOT been executed on production.
- Live goal_contributions.goal_id FK uses ON DELETE CASCADE. The previous
  `deleteGoal` deleted child contributions in a separate request before
  deleting the parent. Fixed branch action now deletes only the owned parent
  with .select('id'), relying on the FK for an atomic cascade. Verified on
  disposable PostgreSQL fixtures.
- `computeContributionTotals` now uses bounded 500-row pagination.
- Backup export now shares strict pagination logic that throws if a page
  unexpectedly returns null; prevents a silently incomplete export.
- New disposable PostgreSQL goal status + parent/child cascade + owner
  isolation regression tests in tests/sql/goals-*.sql and CI workflow.
- Read-only live data integrity scan: 0 goal owner mismatches, 0 duplicate
  Gmail message references, 0 imported records missing a linked transaction.
  There are email drafts in pending/failed states; no automatic deletion or
  retry should occur without a scoped design.

## Remaining P0 work (do not overclaim)

- Full browser/E2E coverage on an isolated application/database.
- Full cloud backup restore path is not implemented; verify recovery before
  treating cloud backup as a disaster recovery solution.
- Goal contributions currently track progress only, not actual bank transfers.
  Do not change ledger balances silently; a new UX/product decision is needed
  for actual source/destination movement.
- Additional RLS checks, Gmail partial-import recovery, validation and
  consistency under concurrent operations.
- All database schema changes staged as SQL **must receive explicit production
  approval**, followed by reviewed rollout coordinating the app code.
