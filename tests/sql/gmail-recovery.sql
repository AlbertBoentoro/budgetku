-- Disposable PostgreSQL only. Simulates Gmail's two-step partial failure:
-- the financial transaction succeeds but the email-import marker has not.
-- A retry MUST link the existing row instead of charging twice.
CREATE TABLE public.email_imports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  gmail_message_id text NOT NULL,
  status text NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id),
  processed_at timestamptz
);
CREATE UNIQUE INDEX email_imports_message_uidx
  ON public.email_imports (user_id, gmail_message_id);
ALTER TABLE public.email_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_imports_owner ON public.email_imports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_imports TO authenticated;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.email_imports (id,user_id,gmail_message_id,status)
VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
'11111111-1111-4111-8111-111111111111','gmail-test-001','pending');

INSERT INTO public.transactions (
 user_id,account_id,category_id,transaction_type,amount,source,source_reference
) VALUES (
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 'expense',75000,'email','gmail-test-001'
);
-- The import row was not linked: a retry would hit 23505 without recovery.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.transactions (
      user_id,account_id,category_id,transaction_type,amount,source,source_reference
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      'expense',75000,'email','gmail-test-001'
    );
    RAISE EXCEPTION 'Duplicate Gmail transaction was not blocked' USING ERRCODE='XX000';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

UPDATE public.email_imports
SET transaction_id=(
    SELECT id FROM public.transactions
    WHERE user_id='11111111-1111-4111-8111-111111111111'
      AND source='email' AND source_reference='gmail-test-001'
  ),
  status='imported', processed_at=now()
WHERE user_id='11111111-1111-4111-8111-111111111111'
  AND gmail_message_id='gmail-test-001';

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.transactions WHERE source_reference='gmail-test-001') <> 1 THEN
    RAISE EXCEPTION 'Duplicate email ledger rows after recovery';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.email_imports e JOIN public.transactions t
      ON t.id=e.transaction_id
    WHERE e.gmail_message_id='gmail-test-001'
      AND e.status='imported'
      AND t.source='email'
      AND t.source_reference=e.gmail_message_id
  ) THEN RAISE EXCEPTION 'Recovered Gmail import was not linked'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: Gmail partial failure can be reconciled without duplicate ledger' AS result;
