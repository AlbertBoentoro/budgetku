import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("balance correction is a protected, atomic audit in the same database UPDATE", () => {
  const sql = read("docs/sql/2026-11-account-balance-adjustments-audit.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.account_balance_adjustments/);
  assert.match(sql, /ALTER TABLE public\.account_balance_adjustments ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FOR SELECT TO authenticated/);
  assert.match(sql, /USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.match(sql, /REVOKE ALL ON public\.account_balance_adjustments FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT ON public\.account_balance_adjustments TO authenticated/);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON public\.account_balance_adjustments TO authenticated/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.capture_account_balance_adjustment_v1/);
  assert.match(sql, /AFTER UPDATE OF initial_balance ON public\.accounts/);
  assert.match(sql, /WHEN \(OLD\.initial_balance IS DISTINCT FROM NEW\.initial_balance\)/);
  assert.match(sql, /INSERT INTO public\.account_balance_adjustments/);
  assert.doesNotMatch(sql, /INSERT INTO public\.transactions|UPDATE public\.transactions/);
  assert.doesNotMatch(sql, /INSERT INTO public\.account_balance_adjustments[\s\S]*?SELECT.*FROM public\.accounts.*created_at/i);
});

test("adjustment table keeps prior and resulting balances and account deletion cannot erase it alone", () => {
  const sql = read("docs/sql/2026-11-account-balance-adjustments-audit.sql");
  assert.match(sql, /balance_before numeric NOT NULL/);
  assert.match(sql, /balance_after numeric NOT NULL/);
  assert.match(sql, /delta numeric NOT NULL CHECK \(delta <> 0\)/);
  assert.match(sql, /CHECK \(delta = balance_after - balance_before\)/);
  assert.match(sql, /ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED/);
  const actions = read("app/(app)/accounts/actions.ts");
  assert.match(actions, /\.from\("account_balance_adjustments"\)/);
  assert.match(actions, /\(adjustments\.count \?\? 0\)/);
  assert.match(actions, /revalidatePath\("\/transactions"\)/);
});

test("corrections appear in the ledger, not income, spending, or the editable transaction table", () => {
  const page = read("app/(app)/transactions/page.tsx");
  const row = read("components/transactions/balance-adjustment-ledger-row.tsx");
  const groups = read("components/transactions/transaction-day-groups.tsx");
  const query = read("lib/account-balance-adjustments.ts");
  const balances = read("lib/accounts.ts");
  const monthly = read("lib/transactions.ts");
  assert.match(page, /fetchBalanceAdjustments\(/);
  assert.match(page, /\.\.\.transactionRows, \.\.\.adjustments/);
  assert.match(groups, /<BalanceAdjustmentLedgerRow/);
  assert.match(groups, /<TransactionLedgerRow/);
  assert.match(row, /Penyesuaian Saldo/);
  assert.match(row, /{adjustment.accountName}/);
  assert.match(row, /value={adjustment.delta}/);
  assert.match(row, /signed/);
  assert.doesNotMatch(row, /Koreksi saldo|bukan pemasukan|pengeluaran/);
  assert.doesNotMatch(row, /wibTime|WIB|transaction_at/);
  assert.doesNotMatch(row, /Sebelum|Sesudah/);
  assert.doesNotMatch(row, /RowActionsMenu/);
  assert.match(query, /if \(filters\.type \|\| filters\.category\) return \[\]/);
  assert.match(query, /\.eq\("user_id", userId\)/);
  assert.match(query, /\.eq\("account_id", filters\.account\)/);
  assert.match(query, /\.gte\("created_at", startISO\)\.lt\("created_at", endISO\)/);
  assert.match(balances, /\.from\("transactions"\)/);
  assert.doesNotMatch(balances, /\.from\("account_balance_adjustments"\)/);
  assert.match(monthly, /\.from\("transactions"\)/);
  assert.doesNotMatch(monthly, /\.from\("account_balance_adjustments"\)/);
});

test("no fabricated backfill for account balance changes made before audit exists", () => {
  const sql = read("docs/sql/2026-11-account-balance-adjustments-audit.sql");
  const ledger = read("lib/account-balance-adjustments.ts");
  assert.doesNotMatch(sql, /INSERT INTO public\.account_balance_adjustments[\s\S]*?FROM public\.accounts/);
  assert.match(sql, /No backfill is attempted/);
  assert.doesNotMatch(ledger, /\.insert\(|\.update\(|\.delete\(/);
});
