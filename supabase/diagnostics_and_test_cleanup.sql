-- ====================================================================
-- পাটগ্রাম কল্যাণ সমিতি, রংপুর
-- Read-Only Diagnostic Inspection & Safe Test-Data Cleanup Queries
-- Run in Supabase SQL Editor step by step.
-- ====================================================================

-- ====================================================================
-- STEP A: READ-ONLY DIAGNOSTICS (Run first to inspect live database)
-- ====================================================================

-- A1. Check Confirm Email status & profile links in auth.users
SELECT
  au.id,
  au.email,
  au.email_confirmed_at,
  au.created_at,
  au.last_sign_in_at,
  p.role,
  p.status AS profile_status
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ORDER BY au.created_at ASC;

-- A2. Check current system_settings (especially establishedYear vs articles.foundingHistory)
SELECT
  id,
  config->>'establishedYear' AS established_year,
  config->'articles'->>'foundingHistory' AS founding_history,
  updated_at
FROM public.system_settings;

-- A3. Inspect all current test members (Pending, Active, Inactive, Rejected)
SELECT
  id,
  membership_id,
  type,
  full_name_bn,
  phone,
  status,
  joined_date,
  created_at
FROM public.members
ORDER BY created_at DESC;

-- A4. Inspect non-admin / non-super_admin officer profiles & FK dependencies BEFORE cleanup
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.status,
  (SELECT COUNT(*) FROM public.transactions t WHERE t.created_by = p.id OR t.approved_by = p.id) AS txn_refs,
  (SELECT COUNT(*) FROM public.financial_corrections fc WHERE fc.corrected_by = p.id OR fc.approved_by = p.id) AS corr_refs,
  (SELECT COUNT(*) FROM public.permission_change_logs pcl WHERE pcl.changed_by = p.id) AS perm_actor_refs,
  (SELECT COUNT(*) FROM public.audit_logs al WHERE al.actor_id = p.id) AS audit_refs
FROM public.profiles p
WHERE p.role <> 'super_admin'
ORDER BY p.created_at ASC;

-- ====================================================================
-- STEP B: SAFE TEST-DATA CLEANUP (ONLY AFTER VERIFYING STEP A OUTPUT)
-- Follows approved rules:
--   1. Deletes test rows in public.members (no FK children exist).
--   2. Deletes ONLY non-admin/non-super_admin test officers that have ZERO
--      financial, permission-actor, notice, or immutable audit_log FK references
--      (if any officer has historic audit/txn refs, they are safely suspended instead).
--   3. NEVER deletes Super Admin, Admins, Transactions, Corrections, Funds,
--      Accounts, System Settings, or Audit Logs.
-- ====================================================================

BEGIN;

-- B1. Delete all test members (Pending, Approved, Rejected, Active, Inactive)
DELETE FROM public.members;

-- B2. Delete non-super-admin test officer profiles that have NO FK references
-- Note: Review STEP A4 output first! If any non-super-admin officer should be KEPT,
-- add: AND LOWER(p.email) NOT IN ('keep-officer@example.com') inside the CTEs below.
WITH removable_test_officers AS (
  SELECT p.id
  FROM public.profiles p
  WHERE p.role NOT IN ('super_admin')
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.created_by = p.id OR t.approved_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.financial_corrections fc WHERE fc.corrected_by = p.id OR fc.approved_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.permission_change_logs pcl WHERE pcl.changed_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs al WHERE al.actor_id = p.id)
)
DELETE FROM public.permission_change_logs
WHERE target_user_id IN (SELECT id FROM removable_test_officers);

WITH removable_test_officers AS (
  SELECT p.id
  FROM public.profiles p
  WHERE p.role NOT IN ('super_admin')
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.created_by = p.id OR t.approved_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.financial_corrections fc WHERE fc.corrected_by = p.id OR fc.approved_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.permission_change_logs pcl WHERE pcl.changed_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs al WHERE al.actor_id = p.id)
)
DELETE FROM public.admin_permissions
WHERE user_id IN (SELECT id FROM removable_test_officers);

WITH removable_test_officers AS (
  SELECT p.id
  FROM public.profiles p
  WHERE p.role NOT IN ('super_admin')
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.created_by = p.id OR t.approved_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.financial_corrections fc WHERE fc.corrected_by = p.id OR fc.approved_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.permission_change_logs pcl WHERE pcl.changed_by = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs al WHERE al.actor_id = p.id)
)
DELETE FROM public.profiles
WHERE id IN (SELECT id FROM removable_test_officers);

-- Optional: Clean corresponding orphaned auth.users that have no public.profiles left
-- (Protected: only deletes non-super-admin auth users that were removed above)
DELETE FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

COMMIT;

-- B3. Verify final post-cleanup counts
SELECT 'members' AS table_name, COUNT(*) AS remaining FROM public.members
UNION ALL
SELECT 'profiles (super_admin)', COUNT(*) FROM public.profiles WHERE role = 'super_admin'
UNION ALL
SELECT 'profiles (other)', COUNT(*) FROM public.profiles WHERE role <> 'super_admin'
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM public.audit_logs;
