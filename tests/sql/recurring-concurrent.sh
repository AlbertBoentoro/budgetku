#!/usr/bin/env bash
# Race test against disposable GitHub Actions PostgreSQL only.
set -euo pipefail
sql="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); SELECT public.generate_recurring_now('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5','2026-01-31');"

set +e
psql -v ON_ERROR_STOP=1 -c "$sql" >/tmp/budgetku-recurring-race-a.log 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -c "$sql" >/tmp/budgetku-recurring-race-b.log 2>&1 &
pid_b=$!
wait "$pid_a"
code_a=$?
wait "$pid_b"
code_b=$?
set -e

if [[ "$code_a" -eq 0 && "$code_b" -eq 0 ]]; then
  echo "FAIL: concurrent requests both succeeded (duplicate occurrence)" >&2
  exit 1
fi
if [[ "$code_a" -ne 0 && "$code_b" -ne 0 ]]; then
  echo "FAIL: both concurrent requests failed" >&2
  sed -n '1,20p' /tmp/budgetku-recurring-race-a.log >&2
  sed -n '1,20p' /tmp/budgetku-recurring-race-b.log >&2
  exit 1
fi

count=$(psql -Atq -c "SELECT count(*) FROM public.transactions WHERE source_reference='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5:2026-01-31';")
due=$(psql -Atq -c "SELECT next_due_date FROM public.recurring_transactions WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5';")
if [[ "$count" != "1" || "$due" != "2026-02-28" ]]; then
  echo "FAIL: race yielded $count occurrences or wrong next due date $due" >&2
  exit 1
fi
echo "PASS: exactly one concurrent request succeeded; next due date advanced once"
