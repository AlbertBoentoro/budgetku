#!/usr/bin/env bash
# Double-submit test against disposable CI PostgreSQL only.
set -euo pipefail
sql="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); SELECT public.create_transaction_with_recurring('cccccccc-cccc-4ccc-8ccc-ccccccccccc6','expense',12345,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',NULL,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','2026-01-31','Double submit',NULL,'Double submit','monthly',NULL);"
psql -v ON_ERROR_STOP=1 -c "$sql" >/tmp/budgetku-new-recurring-a.log 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -c "$sql" >/tmp/budgetku-new-recurring-b.log 2>&1 &
pid_b=$!
wait "$pid_a" || { echo "FAIL first concurrent request"; cat /tmp/budgetku-new-recurring-a.log; exit 1; }
wait "$pid_b" || { echo "FAIL second concurrent request"; cat /tmp/budgetku-new-recurring-b.log; exit 1; }
n=$(psql -Atq -c "SELECT count(*) FROM public.transactions WHERE source_reference='initial-recurring:cccccccc-cccc-4ccc-8ccc-ccccccccccc6';")
t=$(psql -Atq -c "SELECT count(*) FROM public.recurring_transactions WHERE name='Double submit';")
if [[ "$n" != "1" || "$t" != "1" ]]; then
 echo "FAIL: concurrent identical requests created $n transactions and $t templates" >&2
 exit 1
fi
echo "PASS: two simultaneous identical submits created exactly 1 transaction + 1 schedule"
