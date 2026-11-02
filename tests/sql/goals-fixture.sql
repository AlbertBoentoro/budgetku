-- Disposable PostgreSQL test database ONLY. Runs after recurring-fixture.sql.
-- Mirrors live goals status constraint and ON DELETE CASCADE FK.
CREATE TABLE public.financial_goals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  status text NOT NULL DEFAULT 'active',
  CONSTRAINT financial_goals_status_check
    CHECK (status IN ('active','paused','completed','cancelled'))
);
CREATE TABLE public.goal_contributions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0)
);

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_own ON public.financial_goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY contributions_own ON public.goal_contributions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.financial_goals,public.goal_contributions TO authenticated;

INSERT INTO public.financial_goals (id,user_id,name,target_amount,status)
VALUES
('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','11111111-1111-4111-8111-111111111111','Test cascade',100000,'active'),
('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','22222222-2222-4222-8222-222222222222','Other user',200000,'active'),
('cccccccc-cccc-4ccc-8ccc-ccccccccccc3','11111111-1111-4111-8111-111111111111','Test failure rollback',100000,'active');
INSERT INTO public.goal_contributions (id,user_id,goal_id,amount)
VALUES
('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',1000),
('dddddddd-dddd-4ddd-8ddd-ddddddddddd2','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',1500),
('dddddddd-dddd-4ddd-8ddd-ddddddddddd3','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',4000),
('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-ccccccccccc3',5500);

-- Verify that the migration genuinely fixes the live-state mismatch.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.financial_goals'::regclass
    AND conname='financial_goals_status_check') <> 1 THEN
    RAISE EXCEPTION 'Missing baseline goal status check';
  END IF;
END $$;
