-- Budgetku synthetic staging schema only.
-- Execute ONLY against a brand-new, empty Supabase project whose ID differs
-- from the production ID. Never run this fixture on production.
-- Minimal current app-compatible shape; intentionally contains NO real data.
BEGIN;
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('bank','cash','ewallet','credit_card','investment','other')),
  initial_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IDR',
  icon text, color text,
  include_in_total boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,id)
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category_type text NOT NULL CHECK (category_type IN ('income','expense')),
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  icon text, color text,
  is_system boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_system AND user_id IS NULL) OR (NOT is_system AND user_id IS NOT NULL))
);

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Monthly Budget',
  month date NOT NULL, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,month)
);

CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  planned_amount numeric NOT NULL CHECK (planned_amount>=0),
  is_fixed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id,category_id)
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  destination_account_id uuid,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('income','expense','transfer')),
  amount numeric NOT NULL CHECK (amount>0),
  merchant text, description text,
  transaction_at timestamptz NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'IDR',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN
    ('manual','email','receipt','screenshot','statement','import','ai','recurring')),
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id,account_id) REFERENCES public.accounts(user_id,id) ON DELETE CASCADE,
  FOREIGN KEY (user_id,destination_account_id) REFERENCES public.accounts(user_id,id) ON DELETE RESTRICT,
  CHECK ((transaction_type='transfer' AND destination_account_id IS NOT NULL
    AND destination_account_id <> account_id AND category_id IS NULL)
    OR (transaction_type <> 'transfer' AND destination_account_id IS NULL))
);
CREATE UNIQUE INDEX transactions_source_reference_uidx
 ON public.transactions (user_id,source,source_reference) WHERE source_reference IS NOT NULL;

CREATE TABLE public.recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  destination_account_id uuid,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('income','expense','transfer')),
  name text NOT NULL,
  amount numeric NOT NULL CHECK (amount>0),
  merchant text, description text,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count>0),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_due_date date NOT NULL,
  end_date date CHECK (end_date IS NULL OR end_date>=start_date),
  is_active boolean NOT NULL DEFAULT true,
  auto_create boolean NOT NULL DEFAULT false,
  last_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id,account_id) REFERENCES public.accounts(user_id,id) ON DELETE CASCADE,
  FOREIGN KEY (user_id,destination_account_id) REFERENCES public.accounts(user_id,id) ON DELETE RESTRICT,
  CHECK ((transaction_type='transfer' AND destination_account_id IS NOT NULL
     AND destination_account_id <> account_id AND category_id IS NULL)
     OR (transaction_type <> 'transfer' AND destination_account_id IS NULL))
);

CREATE TABLE public.financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount>0),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_date date CHECK (target_date IS NULL OR target_date>=start_date),
  account_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK
    (status IN ('active','paused','completed','cancelled','achieved','archived')),
  icon text, color text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,id),
  FOREIGN KEY (user_id,account_id) REFERENCES public.accounts(user_id,id) ON DELETE SET NULL
);
CREATE TABLE public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount>0),
  contributed_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id,goal_id) REFERENCES public.financial_goals(user_id,id) ON DELETE CASCADE
);

CREATE TABLE public.merchant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  pattern text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('exact','contains','starts_with')),
  priority integer NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_system AND user_id IS NULL) OR (NOT is_system AND user_id IS NOT NULL))
);

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'id-ID' CHECK (locale='id-ID'),
  currency text NOT NULL DEFAULT 'IDR' CHECK (currency='IDR'),
  first_day_of_week text NOT NULL DEFAULT 'monday' CHECK (first_day_of_week IN ('monday','sunday')),
  daily_reminder_enabled boolean NOT NULL DEFAULT false,
  daily_reminder_time time NOT NULL DEFAULT '20:00:00',
  cloud_backup_enabled boolean NOT NULL DEFAULT false,
  last_backup_at timestamptz,
  last_reminder_sent_on date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['accounts','budget_items','budgets','categories',
  'transactions','recurring_transactions','financial_goals','goal_contributions',
  'merchant_rules','user_settings'])
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  IF t='categories' OR t='merchant_rules' THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id=(select auth.uid()) OR (is_system AND user_id IS NULL))', 'stage_'||t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()) AND NOT is_system)', 'stage_'||t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id=(select auth.uid()) AND NOT is_system) WITH CHECK (user_id=(select auth.uid()) AND NOT is_system)', 'stage_'||t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id=(select auth.uid()) AND NOT is_system)', 'stage_'||t||'_delete', t);
  ELSE
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()))','stage_'||t||'_owner',t);
  END IF;
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
 END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('budgetku-backups','budgetku-backups',false,10485760)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "stage backup read" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='budgetku-backups' AND (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY "stage backup create" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='budgetku-backups' AND (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY "stage backup edit" ON storage.objects FOR UPDATE TO authenticated
 USING (bucket_id='budgetku-backups' AND (storage.foldername(name))[1]=(select auth.uid())::text)
 WITH CHECK (bucket_id='budgetku-backups' AND (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY "stage backup delete" ON storage.objects FOR DELETE TO authenticated
 USING (bucket_id='budgetku-backups' AND (storage.foldername(name))[1]=(select auth.uid())::text);
COMMIT;
-- Purely synthetic staging; no customer or production database row is copied.
