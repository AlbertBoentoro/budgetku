-- No production tables or real accounts; authenticated disposable fixtures only.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
-- App writes archived/achieved; both must be accepted after staged migration.
-- A contribution owned by user B cannot reference a goal owned by user A,
-- even if the attacker submits the goal UUID directly to the data API.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $
BEGIN
 BEGIN
  INSERT INTO public.goal_contributions (id,user_id,goal_id,amount)
  VALUES ('dddddddd-dddd-4ddd-8ddd-ddddddddddd5',
  '22222222-2222-4222-8222-222222222222',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',888);
  RAISE EXCEPTION 'Cross-owner contribution allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN SQLSTATE '23503' THEN NULL;
 END;
END $;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

UPDATE public.financial_goals SET status='achieved'
WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
UPDATE public.financial_goals SET status='archived'
WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
DO $$
BEGIN
  IF (SELECT status FROM public.financial_goals WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1') <> 'achieved' THEN
    RAISE EXCEPTION 'achieved status not persisted';
  END IF;
  IF (SELECT status FROM public.financial_goals WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3') <> 'archived' THEN
    RAISE EXCEPTION 'archived status not persisted';
  END IF;
END $$;

-- Another user's goal is invisible and cannot be deleted from this session.
DO $$
DECLARE removed integer;
BEGIN
  DELETE FROM public.financial_goals
  WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
    AND user_id='11111111-1111-4111-8111-111111111111';
  GET DIAGNOSTICS removed=ROW_COUNT;
  IF removed <> 0 THEN RAISE EXCEPTION 'Cross-user delete succeeded'; END IF;
END $$;

-- Parent delete cascades all child rows in one database operation.
DELETE FROM public.financial_goals
WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  AND user_id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.financial_goals WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
 OR EXISTS (SELECT 1 FROM public.goal_contributions WHERE goal_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1') THEN
 RAISE EXCEPTION 'Cascade failed';
 END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.financial_goals WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2')
 OR NOT EXISTS (SELECT 1 FROM public.goal_contributions WHERE id='dddddddd-dddd-4ddd-8ddd-ddddddddddd3') THEN
 RAISE EXCEPTION 'Cross-user data deleted';
 END IF;
END $$;

-- Deliberately reject goal deletion and confirm contribution remains.
CREATE OR REPLACE FUNCTION public.reject_test_goal_deletion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.name='Test failure rollback' THEN
  RAISE EXCEPTION 'Simulated goal deletion failure' USING ERRCODE='P0001';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER reject_test_goal BEFORE DELETE ON public.financial_goals
FOR EACH ROW EXECUTE FUNCTION public.reject_test_goal_deletion();
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
BEGIN
 BEGIN
  DELETE FROM public.financial_goals
   WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
     AND user_id='11111111-1111-4111-8111-111111111111';
  RAISE EXCEPTION 'Failure fixture incorrectly deleted goal' USING ERRCODE='XX000';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
 END;
 IF NOT EXISTS (SELECT 1 FROM public.financial_goals
   WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3') THEN
   RAISE EXCEPTION 'Parent lost on failed delete';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.goal_contributions
   WHERE goal_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3') THEN
   RAISE EXCEPTION 'Contributions lost on failed delete';
 END IF;
END $$;
RESET ROLE;
SELECT 'PASS: goals status and cascading delete checks' AS result;
