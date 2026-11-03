# Budgetku recovery — read-only validation boundary

This PR extracts the pure, **read-only** format-v1 restore impact planner from the
older stacked PR #12, based on the current production `main` after PR #14.
It is intentionally **not imported by any application route or user interface**.

## Why extract this part first?

Restoring financial records can replace or delete ledger entries. The existing
staging proof is useful, but draft PRs #11 and #12 contain destructive restore
prototypes stacked on an older test branch. Their release blockers must not be
hidden inside a large merge.

The old preview compared only selected financial fields on Gmail-linked
transactions; the prototype SQL compared the **whole transaction row**.
Consequently, a changed merchant, description, timestamp, or other metadata
could receive an optimistic preview only to be rejected at apply time.

This planner now rejects **any** full-row difference for a transaction ID
linked to an email import. It validates owner-scope, record references,
duplicate identifiers, category cycles and shared system categories; then it
computes per-table add/change/remove counts. It never connects to Supabase.

## What this PR cannot prove

- A pure validation result is not authorization to replace live data.
- It does not verify concurrent transactions, other database constraints,
  service integrations, backups or recovery from failure.
- A future restore API must recheck the entire current state inside the
  transaction, preserve Gmail links, create and verify an immutable safety
  snapshot first, and refuse stale approvals.
- Backups do not include Gmail OAuth tokens, drafts, or all connected-service
  state. Users must not treat a ledger restore as account-wide disaster recovery.

## Release boundaries

This PR adds only `lib/settings/restore-plan-core.mjs`, unit tests, and this
documentation. There is **no** restore endpoint, write function, UI activation,
production SQL migration, or data modification. Keep this PR draft until
CI succeeds and a separate production merge approval is granted.
