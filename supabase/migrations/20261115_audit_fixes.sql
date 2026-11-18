-- ====================================================================
-- পাটগ্রাম কল্যাণ সমিতি, রংপুর — Coordinated Audit Fixes Migration
-- Date: 2026-11-15
-- Safe / Non-Destructive / Idempotent (Safe to run in Supabase SQL Editor)
-- NOTE: Does NOT delete real members, officers, transactions, or Super Admin.
-- NOTE: Does NOT alter system_settings.config->articles->foundingHistory.
-- NOTE: Does NOT change 30,000 BDT financial correction approval rules.
-- ====================================================================

-- 1. Add missing columns non-destructively (Schema <-> App parity)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_by_role user_role;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS balance_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark pre-existing approved/corrected transactions as balance_applied = TRUE
-- so atomic approval functions never double-apply historic ledger balances.
UPDATE public.transactions
SET balance_applied = TRUE
WHERE status IN ('approved', 'corrected')
  AND balance_applied = FALSE;

ALTER TABLE public.financial_corrections
  ADD COLUMN IF NOT EXISTS corrected_by_role user_role;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Tighten RLS Policies (Non-Destructive)
DROP POLICY IF EXISTS "Public can submit aid application" ON public.aid_applications;
CREATE POLICY "Public can submit aid application"
ON public.aid_applications FOR INSERT
WITH CHECK (status = 'submitted');

DROP POLICY IF EXISTS "Authenticated admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated admins can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  )
);

-- 3. Update system_settings.establishedYear -> 2000 ONLY (leaving foundingHistory untouched)
UPDATE public.system_settings
SET config = jsonb_set(config, '{establishedYear}', '2000'::jsonb, true),
    updated_at = NOW()
WHERE id = 'default'
  AND (config->>'establishedYear' IS NULL OR config->>'establishedYear' = '2009');

-- 4. Atomic Transaction Balance & Approval Procedures (with Permission + Idempotency Guards)
CREATE OR REPLACE FUNCTION public.fn_process_approved_transaction(p_txn_id UUID)
RETURNS VOID AS $$
DECLARE
  v_txn public.transactions%ROWTYPE;
BEGIN
  IF NOT (public.has_permission('can_approve_finance') OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Permission denied: cannot apply approved transaction balances.';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction ID not found: %', p_txn_id;
  END IF;

  IF v_txn.balance_applied THEN
    RETURN;
  END IF;

  IF v_txn.status <> 'approved' THEN
    RAISE EXCEPTION 'Transaction must be approved to affect ledger balance.';
  END IF;

  IF v_txn.type = 'income' THEN
    UPDATE public.funds SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.fund_id;
    UPDATE public.accounts SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.account_id;
  ELSIF v_txn.type = 'expense' THEN
    UPDATE public.funds SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.fund_id;
    UPDATE public.accounts SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.account_id;
  ELSIF v_txn.type = 'fund_transfer' THEN
    UPDATE public.funds SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.fund_id;
    UPDATE public.funds SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.to_fund_id;
    UPDATE public.accounts SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.account_id;
    UPDATE public.accounts SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.to_account_id;
  END IF;

  UPDATE public.transactions SET balance_applied = TRUE WHERE id = p_txn_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.fn_process_approved_transaction(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_transaction_atomic(p_txn_id UUID)
RETURNS TABLE (
  id UUID,
  status txn_status,
  approved_at TIMESTAMPTZ
) AS $$
DECLARE
  v_txn public.transactions%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT (public.has_permission('can_approve_finance') OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Permission denied: cannot approve financial transactions.';
  END IF;

  SELECT * INTO v_txn FROM public.transactions t WHERE t.id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_txn_id;
  END IF;

  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Transaction is not pending approval (current status: %).', v_txn.status;
  END IF;

  UPDATE public.transactions t
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = v_now
  WHERE t.id = p_txn_id;

  PERFORM public.fn_process_approved_transaction(p_txn_id);

  RETURN QUERY SELECT p_txn_id, 'approved'::txn_status, v_now;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_transaction_atomic(UUID) TO authenticated;

-- 5. Member Application: Issue Temporary Tracking ID (APP-YYYY-XXXXXX) on Submit,
--    and Assign Official Member Serial (PKS-GEN/PKS-STU) ONLY upon Admin Approval!
CREATE OR REPLACE FUNCTION public.submit_public_member_application(
  p_type member_type,
  p_full_name_bn TEXT,
  p_full_name_en TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_blood_group TEXT DEFAULT NULL,
  p_patgram_village TEXT DEFAULT '',
  p_patgram_union TEXT DEFAULT '',
  p_patgram_ward TEXT DEFAULT NULL,
  p_rangpur_area TEXT DEFAULT '',
  p_rangpur_thana TEXT DEFAULT '',
  p_profession TEXT DEFAULT NULL,
  p_institution TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_academic_year TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  membership_id TEXT,
  joined_date DATE
) AS $$
DECLARE
  v_year TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_tracking_id TEXT;
  v_new_id UUID;
  v_joined DATE;
BEGIN
  PERFORM pg_advisory_xact_lock(77665544);

  v_tracking_id := 'APP-' || v_year || '-' || LPAD((FLOOR(100000 + RANDOM() * 899999))::INT::TEXT, 6, '0');
  WHILE EXISTS (SELECT 1 FROM public.members m WHERE m.membership_id = v_tracking_id) LOOP
    v_tracking_id := 'APP-' || v_year || '-' || LPAD((FLOOR(100000 + RANDOM() * 899999))::INT::TEXT, 6, '0');
  END LOOP;

  INSERT INTO public.members (
    membership_id,
    type,
    full_name_bn,
    full_name_en,
    phone,
    email,
    blood_group,
    patgram_village,
    patgram_union,
    patgram_ward,
    rangpur_area,
    rangpur_thana,
    profession,
    institution,
    department,
    academic_year,
    status
  )
  VALUES (
    v_tracking_id,
    p_type,
    TRIM(p_full_name_bn),
    COALESCE(NULLIF(TRIM(p_full_name_en), ''), TRIM(p_full_name_bn)),
    TRIM(p_phone),
    NULLIF(TRIM(COALESCE(p_email, '')), ''),
    NULLIF(TRIM(COALESCE(p_blood_group, '')), ''),
    TRIM(p_patgram_village),
    COALESCE(NULLIF(TRIM(p_patgram_union), ''), 'পাটগ্রাম'),
    NULLIF(TRIM(COALESCE(p_patgram_ward, '')), ''),
    TRIM(p_rangpur_area),
    TRIM(p_rangpur_thana),
    NULLIF(TRIM(COALESCE(p_profession, '')), ''),
    NULLIF(TRIM(COALESCE(p_institution, '')), ''),
    NULLIF(TRIM(COALESCE(p_department, '')), ''),
    NULLIF(TRIM(COALESCE(p_academic_year, '')), ''),
    'pending'
  )
  RETURNING members.id, members.membership_id, members.joined_date
  INTO v_new_id, v_tracking_id, v_joined;

  RETURN QUERY SELECT v_new_id, v_tracking_id, v_joined;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.submit_public_member_application(
  member_type, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_member_application(p_member_id UUID)
RETURNS TABLE (
  id UUID,
  membership_id TEXT,
  status member_status
) AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_prefix TEXT;
  v_year TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_pattern TEXT;
  v_next_seq INT;
  v_new_serial TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(77665545);

  SELECT * INTO v_member FROM public.members m WHERE m.id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  IF NOT (
    public.is_super_admin()
    OR (v_member.type = 'student' AND public.has_permission('can_manage_student_wing'))
    OR (v_member.type <> 'student' AND public.has_permission('can_manage_members'))
  ) THEN
    RAISE EXCEPTION 'Permission denied: cannot approve this member wing.';
  END IF;

  v_prefix := CASE WHEN v_member.type = 'student' THEN 'PKS-STU' ELSE 'PKS-GEN' END;

  IF v_member.membership_id LIKE 'APP-%'
     OR v_member.membership_id !~ ('^' || v_prefix || '-[0-9]{4}-[0-9]+$') THEN
    v_pattern := '^' || v_prefix || '-' || v_year || '-([0-9]+)$';

    SELECT COALESCE(
      MAX(
        CASE
          WHEN m.membership_id ~ v_pattern
          THEN SUBSTRING(m.membership_id FROM v_pattern)::INT
          ELSE 0
        END
      ),
      0
    ) + 1
    INTO v_next_seq
    FROM public.members m
    WHERE m.id <> p_member_id;

    v_new_serial := v_prefix || '-' || v_year || '-' || LPAD(v_next_seq::TEXT, 3, '0');
    WHILE EXISTS (
      SELECT 1 FROM public.members m WHERE m.membership_id = v_new_serial AND m.id <> p_member_id
    ) LOOP
      v_next_seq := v_next_seq + 1;
      v_new_serial := v_prefix || '-' || v_year || '-' || LPAD(v_next_seq::TEXT, 3, '0');
    END LOOP;
  ELSE
    v_new_serial := v_member.membership_id;
  END IF;

  UPDATE public.members m
  SET membership_id = v_new_serial,
      status = 'active'
  WHERE m.id = p_member_id;

  RETURN QUERY SELECT p_member_id, v_new_serial, 'active'::member_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_member_application(UUID) TO authenticated;

-- 6. Officer Signup Requested Role Support + Self-Heal & Safe Test Officer Deletion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_count INT;
  v_req_role TEXT;
  v_role user_role;
  v_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(99887766);

  SELECT COUNT(*) INTO v_user_count FROM public.profiles;
  v_req_role := NULLIF(TRIM(NEW.raw_user_meta_data->>'requested_role'), '');

  IF v_user_count = 0 THEN
    v_role := 'super_admin';
    v_status := 'active';
  ELSE
    IF v_req_role IN ('finance_secretary', 'president', 'general_secretary', 'general_admin', 'student_admin') THEN
      v_role := v_req_role::user_role;
    ELSE
      v_role := 'general_admin';
    END IF;
    v_status := 'pending_approval';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    v_role,
    v_status
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.admin_permissions (
    user_id,
    can_view_finance, can_entry_finance, can_approve_finance,
    can_view_reports, can_export_reports, can_correct_finance,
    can_view_correction_history, can_manage_funds, can_manage_accounts,
    can_manage_members, can_manage_student_wing, can_manage_committees,
    can_manage_notices, can_manage_settings, can_export_backup
  ) VALUES (
    NEW.id,
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_or_bootstrap_profile()
RETURNS public.profiles AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_user RECORD;
  v_user_count INT;
  v_req_role TEXT;
  v_role user_role;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF FOUND THEN
    RETURN v_profile;
  END IF;

  SELECT id, email, raw_user_meta_data INTO v_user
  FROM auth.users
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found for %', v_uid;
  END IF;

  PERFORM pg_advisory_xact_lock(99887766);
  SELECT COUNT(*) INTO v_user_count FROM public.profiles;
  v_req_role := NULLIF(TRIM(v_user.raw_user_meta_data->>'requested_role'), '');

  IF v_user_count = 0 THEN
    v_role := 'super_admin';
    v_status := 'active';
  ELSE
    IF v_req_role IN ('finance_secretary', 'president', 'general_secretary', 'general_admin', 'student_admin') THEN
      v_role := v_req_role::user_role;
    ELSE
      v_role := 'general_admin';
    END IF;
    v_status := 'pending_approval';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, status)
  VALUES (
    v_user.id,
    COALESCE(v_user.email, ''),
    COALESCE(NULLIF(TRIM(v_user.raw_user_meta_data->>'full_name'), ''), v_user.email, 'অ্যাডমিন'),
    NULLIF(TRIM(COALESCE(v_user.raw_user_meta_data->>'phone', '')), ''),
    v_role,
    v_status
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.admin_permissions (
    user_id,
    can_view_finance, can_entry_finance, can_approve_finance,
    can_view_reports, can_export_reports, can_correct_finance,
    can_view_correction_history, can_manage_funds, can_manage_accounts,
    can_manage_members, can_manage_student_wing, can_manage_committees,
    can_manage_notices, can_manage_settings, can_export_backup
  ) VALUES (
    v_user.id,
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin')
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.sync_or_bootstrap_profile() TO authenticated;

-- Safe non-super-admin / test officer deletion RPC (verifies FK constraints first)
CREATE OR REPLACE FUNCTION public.delete_test_officer_profile(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: Only Super Admin can delete officer accounts.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own active Super Admin account.';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Officer profile not found.';
  END IF;

  IF v_target.role = 'super_admin' THEN
    RAISE EXCEPTION 'Super Admin accounts cannot be deleted.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.transactions WHERE created_by = p_user_id OR approved_by = p_user_id)
     OR EXISTS (SELECT 1 FROM public.financial_corrections WHERE corrected_by = p_user_id OR approved_by = p_user_id)
     OR EXISTS (SELECT 1 FROM public.permission_change_logs WHERE changed_by = p_user_id)
     OR EXISTS (SELECT 1 FROM public.notices WHERE created_by = p_user_id)
     OR EXISTS (SELECT 1 FROM public.audit_logs WHERE actor_id = p_user_id) THEN
    RAISE EXCEPTION 'এই কর্মকর্তার সাথে পূর্বের লেনদেন, নোটিশ বা অডিট লগ যুক্ত থাকায় স্থায়ীভাবে ডিলিট করা যাবে না; অনুগ্রহ করে অ্যাকাউন্টটি "স্থগিত" করুন।';
  END IF;

  DELETE FROM public.admin_permissions WHERE user_id = p_user_id;
  DELETE FROM public.permission_change_logs WHERE target_user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;

  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.delete_test_officer_profile(UUID) TO authenticated;
