-- Disposable PostgreSQL fixture. NEVER run this file on production.
-- Matches the subset of live constraints/ownership used by the recurring RPC.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  is_archived boolean NOT NULL DEFAULT false
);
CREATE TABLE public.categories (
  id uuid PRIMARY KEY,
  user_id uuid,
  category_type text NOT NULL,
  is_archived boolean NOT NULL DEFAULT false
);
CREATE TABLE public.recurring_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  destination_account_id uuid,
  category_id uuid,
  transaction_type text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  merchant text,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval_count integer NOT NULL CHECK (interval_count > 0),
  start_date date NOT NULL,
  next_due_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  auto_create boolean NOT NULL DEFAULT false,
  last_generated_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  destination_account_id uuid REFERENCES public.accounts(id),
  category_id uuid REFERENCES public.categories(id),
  transaction_type text NOT NULL CHECK (transaction_type IN ('income','expense','transfer')),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'IDR',
  transaction_at timestamptz NOT NULL DEFAULT now(),
  description text,
  merchant text,
  source text NOT NULL DEFAULT 'manual',
  source_reference text,
  CONSTRAINT transactions_source_check
    CHECK (source IN ('manual','email','receipt','screenshot','statement','import','ai'))
);
CREATE UNIQUE INDEX transactions_source_reference_uidx
  ON public.transactions (user_id, source, source_reference)
  WHERE source_reference IS NOT NULL;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_owner ON public.accounts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY categories_visible ON public.categories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY recurring_owner ON public.recurring_transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY transactions_owner ON public.transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

INSERT INTO public.accounts (id,user_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','22222222-2222-4222-8222-222222222222');
INSERT INTO public.categories (id,user_id,category_type) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','11111111-1111-4111-8111-111111111111','expense'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','11111111-1111-4111-8111-111111111111','income');
INSERT INTO public.recurring_transactions
 (id,user_id,account_id,destination_account_id,category_id,transaction_type,name,
  amount,merchant,frequency,interval_count,start_date,next_due_date,end_date)
VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 'expense','Monthly Jan31',50000,'regular','monthly',1,'2026-01-31','2026-01-31',null),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',null,
 'transfer','Weekly transfer',125000,'regular','weekly',2,'2026-02-01','2026-02-01',null),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 'expense','End date reached',25000,'regular','monthly',1,'2026-01-31','2026-01-31','2026-01-31'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 'expense','Forced write error',33333,'fail-test','monthly',1,'2026-01-31','2026-01-31',null),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 'expense','Concurrent',88888,'regular','monthly',1,'2026-01-31','2026-01-31',null),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 'expense','Archived account',77777,'regular','monthly',1,'2026-01-31','2026-01-31',null),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 'expense','Archived category',99999,'regular','monthly',1,'2026-01-31','2026-01-31',null);

-- Intentional failure AFTER RPC's ownership and active checks: must roll back
-- the entire transaction, including schedule advancement.
CREATE OR REPLACE FUNCTION public.reject_synthetic_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.merchant = 'fail-test' THEN
   RAISE EXCEPTION 'Synthetic ledger insert failure' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER reject_synthetic_write
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.reject_synthetic_write();
