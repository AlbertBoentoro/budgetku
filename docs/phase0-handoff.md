# Budgetku Phase 0 — handoff for ChatGPT / Codex / reviewers

Updated: 2026-11-01. This file is intentionally durable context so the user
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
