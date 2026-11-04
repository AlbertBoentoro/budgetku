-- DEVELOPMENT/TESTING ONLY. Never execute against production without owner consent.
-- A full-account restore would replace newer transactions and must not be
-- invokable through the client Data API without an explicit per-row review.
-- Keep the verified transaction-specific recovery RPC available.
REVOKE ALL ON FUNCTION public.restore_budgetku_backup_v1(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.budgetku_restore_atomic_v1_test(jsonb, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
-- Future full restore implementation must resolve each conflict explicitly.
