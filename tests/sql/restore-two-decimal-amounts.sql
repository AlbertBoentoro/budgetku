-- Run only in disposable CI PostgreSQL against the authenticated fixture.
-- Covers exact cents and rejects fractional precision that the UI disallows.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

SELECT public.restore_selected_transactions_v1(jsonb_build_array(jsonb_build_object(
  'id','ffffffff-ffff-4fff-8fff-fffffffffff1',
  'user_id','11111111-1111-4111-8111-111111111111',
  'account_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'destination_account_id',null,
  'category_id','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'transaction_type','expense',
  'amount',0.41,
  'currency','IDR',
  'source','manual',
  'source_reference',null,
  'transaction_at','2026-11-07T12:00:00Z',
  'created_at','2026-11-07T12:00:00Z',
  'updated_at','2026-11-07T12:00:00Z'
))) AS inserted_count;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transactions
      WHERE id='ffffffff-ffff-4fff-8fff-fffffffffff1'
        AND amount=0.41 AND source='manual') THEN
    RAISE EXCEPTION 'Decimal recovery did not preserve Rp 0,41';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM public.restore_selected_transactions_v1(jsonb_build_array(jsonb_build_object(
    'id','ffffffff-ffff-4fff-8fff-fffffffffff2',
    'user_id','11111111-1111-4111-8111-111111111111',
    'account_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'destination_account_id',null,
    'category_id','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    'transaction_type','expense',
    'amount',0.415,
    'currency','IDR',
    'source','manual',
    'source_reference',null,
    'transaction_at','2026-11-07T12:00:00Z',
    'created_at','2026-11-07T12:00:00Z',
    'updated_at','2026-11-07T12:00:00Z'
  )));
  RAISE EXCEPTION '3-decimal amount accepted' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
END $$;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.transactions
   WHERE id='ffffffff-ffff-4fff-8fff-fffffffffff2') THEN
    RAISE EXCEPTION 'Invalid fractional write survived rollback';
  END IF;
END $$;
RESET ROLE;
SELECT 'PASS: two-decimal selective restoration' AS result;
