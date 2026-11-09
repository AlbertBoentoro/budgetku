-- Synthetic TEST-ONLY data in budgetku-staging. Never run in production.
-- Uses the single pre-existing staging test user, never a real Gmail connection.
-- Staging-only draft rows can be accepted/rejected for UI flow verification.
BEGIN;
DO $$
DECLARE
  v_user uuid;
  v_connection uuid;
BEGIN
  IF (SELECT count(*) FROM auth.users) <> 1 THEN
    RAISE EXCEPTION 'Staging must have exactly one existing test user';
  END IF;
  SELECT id INTO STRICT v_user FROM auth.users LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id=v_user AND is_archived=false) THEN
    RAISE EXCEPTION 'No active test account; do not seed pending Gmail';
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_imports WHERE user_id=v_user) THEN
    RAISE EXCEPTION 'Existing staging Gmail drafts detected: abort fixture import';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts
      WHERE user_id=v_user AND name='Dompet Gmail Testing') THEN
    INSERT INTO public.accounts
      (user_id,name,account_type,initial_balance,currency,include_in_total,is_archived)
    VALUES(v_user,'Dompet Gmail Testing','ewallet',100000,'IDR',true,false);
  END IF;

  INSERT INTO public.email_connections
    (user_id,provider,email_address,status,last_synced_at)
  VALUES(v_user,'gmail','demo-gmail@budgetku.invalid','disconnected',null)
  RETURNING id INTO v_connection;

  INSERT INTO public.email_imports
    (user_id,connection_id,gmail_message_id,subject,sender,received_at,
     status,parsed_preview)
  VALUES
    (v_user,v_connection,'staging-gmail-demo-expense-20261109',
     '[DEMO] Pembayaran Grab Rp14.400',
     'demo-grab@budgetku.invalid','2026-11-09T08:12:00+07:00',
     'pending',jsonb_build_object(
       'parserVersion',3,'source','bca','amount',14400,'direction','expense',
       'transactionAt','2026-11-09','merchant','Grab',
       'description','Contoh email staging, bukan transaksi nyata','confidence','high'
     )),
    (v_user,v_connection,'staging-gmail-demo-income-20261109',
     '[DEMO] Dana Masuk Rp50.000,41',
     'demo-bank@budgetku.invalid','2026-11-09T07:44:00+07:00',
     'pending',jsonb_build_object(
       'parserVersion',3,'source','bca','amount',50000.41,'direction','income',
       'transactionAt','2026-11-09','merchant','Transfer dari teman',
       'description','Contoh email staging dengan sen','confidence','high'
     )),
    (v_user,v_connection,'staging-gmail-demo-ambiguous-20261109',
     '[DEMO] Mutasi rekening, perlu ditinjau',
     'demo-bank@budgetku.invalid','2026-11-08T12:05:00+07:00',
     'pending',jsonb_build_object(
       'parserVersion',3,'source','bca','amount',12500,'direction',null,
       'transactionAt','2026-11-08','merchant',null,
       'description','Demo untuk memilih Transfer dan rekening tujuan','confidence','low'
     ));
END $$;
COMMIT;
