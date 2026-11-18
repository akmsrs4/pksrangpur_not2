-- ====================================================================
-- পাটগ্রাম কল্যাণ সমিতি, রংপুর (স্থাপিত: ২০০০)
-- Central PostgreSQL Database Schema & Security Architecture
-- Target: Supabase Free Tier (PostgreSQL 15+)
-- Description: Single unified script. Safe to run in Supabase SQL Editor.
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Role & Status Enums (Safe Creation)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin',
    'finance_secretary',
    'president',
    'general_secretary',
    'general_admin',
    'student_admin',
    'event_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Safe enum extension for pre-existing databases running updated schema.sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'event_admin'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'event_admin';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_type AS ENUM ('general', 'student', 'alumni', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('pending', 'active', 'inactive', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM ('income', 'expense', 'fund_transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE txn_status AS ENUM ('pending_approval', 'approved', 'rejected', 'corrected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE correction_status AS ENUM ('approved', 'pending_approval', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Profiles Table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'general_admin',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Granular Admin Permissions Table (Security Matrix)
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_view_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_entry_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_reports BOOLEAN NOT NULL DEFAULT FALSE,
  can_export_reports BOOLEAN NOT NULL DEFAULT FALSE,
  can_correct_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_correction_history BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_funds BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_accounts BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_members BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_student_wing BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_committees BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_notices BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_settings BOOLEAN NOT NULL DEFAULT FALSE,
  can_export_backup BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_view_module BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_manage_categories BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_view_applications BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_approve_application BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_verify_payment BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_manage_refund BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_manage_ledger BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_delete_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_view_finance_summary BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_export_reports BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_manage_settings BOOLEAN NOT NULL DEFAULT FALSE,
  can_event_view_logs BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Permission Change History Log Table
CREATE TABLE IF NOT EXISTS public.permission_change_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_role user_role NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  permission_key TEXT NOT NULL,
  old_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Members Table (100% PRIVATE: Zero Public Exposure)
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id TEXT NOT NULL UNIQUE,
  type member_type NOT NULL DEFAULT 'general',
  full_name_bn TEXT NOT NULL,
  full_name_en TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  blood_group TEXT,
  patgram_village TEXT NOT NULL,
  patgram_union TEXT NOT NULL,
  patgram_ward TEXT,
  rangpur_area TEXT NOT NULL,
  rangpur_thana TEXT NOT NULL,
  profession TEXT,
  institution TEXT, -- For student wing members
  department TEXT, -- For student wing members
  academic_year TEXT, -- For student wing members
  photo_url TEXT,
  status member_status NOT NULL DEFAULT 'pending',
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Committee Terms Table
CREATE TABLE IF NOT EXISTS public.committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL, -- e.g. "কার্যকরী পরিষদ (২০২৫-২০২৭)"
  wing TEXT NOT NULL DEFAULT 'central', -- 'central' | 'student_wing' | 'advisory'
  start_year INT NOT NULL,
  end_year INT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Committee Positions Table
-- Default is_published = FALSE: Names & photos hidden by default until admin publishes!
CREATE TABLE IF NOT EXISTS public.committee_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- সভাপতি, সাধারণ সম্পাদক, ইত্যাদি
  member_name_bn TEXT NOT NULL,
  member_name_en TEXT,
  phone TEXT, -- Private: Not exposed in public views
  photo_url TEXT,
  priority INT NOT NULL DEFAULT 99,
  is_published BOOLEAN NOT NULL DEFAULT FALSE, -- Privacy toggle: defaults to FALSE!
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Secure Public View for Committee Members
-- Excludes phone and private contact information completely!
CREATE OR REPLACE VIEW public.public_committee_members AS
SELECT 
  cp.id,
  cp.committee_id,
  c.title AS committee_title,
  c.wing,
  cp.title AS position_title,
  cp.member_name_bn,
  cp.member_name_en,
  cp.photo_url,
  cp.priority
FROM public.committee_positions cp
JOIN public.committees c ON c.id = cp.committee_id
WHERE cp.is_published = TRUE;

-- 10. Financial Funds Table (Overdraft Prevention: balance >= 0)
CREATE TABLE IF NOT EXISTS public.funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_balance >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Financial Accounts Table (Bank, Cash, Mobile Banking: balance >= 0)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'bank' | 'cash' | 'mobile_banking' | 'other'
  account_number TEXT,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_balance >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Financial Transactions Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_code TEXT NOT NULL UNIQUE,
  voucher_no TEXT NOT NULL UNIQUE,
  type txn_type NOT NULL,
  fund_id UUID NOT NULL REFERENCES public.funds(id),
  to_fund_id UUID REFERENCES public.funds(id), -- Only for fund_transfer
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_id UUID REFERENCES public.accounts(id), -- Only for fund_transfer
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  donor_or_payee TEXT NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  status txn_status NOT NULL DEFAULT 'pending_approval',
  balance_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_by_role user_role,
  approved_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- 13. Financial Corrections Table
-- Implements Decision 1.খ: Delta = ABS(corrected_amount - previous_amount)
CREATE TABLE IF NOT EXISTS public.financial_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correction_code TEXT NOT NULL UNIQUE,
  original_transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  previous_amount NUMERIC(14, 2) NOT NULL,
  corrected_amount NUMERIC(14, 2) NOT NULL CHECK (corrected_amount >= 0),
  delta_amount NUMERIC(14, 2) GENERATED ALWAYS AS (ABS(corrected_amount - previous_amount)) STORED,
  previous_category TEXT NOT NULL,
  corrected_category TEXT NOT NULL,
  previous_fund_id UUID NOT NULL REFERENCES public.funds(id),
  corrected_fund_id UUID NOT NULL REFERENCES public.funds(id),
  previous_account_id UUID NOT NULL REFERENCES public.accounts(id),
  corrected_account_id UUID NOT NULL REFERENCES public.accounts(id),
  previous_to_fund_id UUID REFERENCES public.funds(id),
  corrected_to_fund_id UUID REFERENCES public.funds(id),
  previous_to_account_id UUID REFERENCES public.accounts(id),
  corrected_to_account_id UUID REFERENCES public.accounts(id),
  original_snapshot JSONB NOT NULL,
  corrected_snapshot JSONB NOT NULL,
  correction_reason TEXT NOT NULL CHECK (LENGTH(TRIM(correction_reason)) >= 5),
  requires_dual_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status correction_status NOT NULL DEFAULT 'pending_approval',
  corrected_by UUID NOT NULL REFERENCES public.profiles(id),
  corrected_by_role user_role,
  approved_by UUID REFERENCES public.profiles(id),
  approval_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- 14. Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES public.profiles(id),
  actor_role user_role NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  previous_hash TEXT,
  current_hash TEXT NOT NULL
);

-- Immutability trigger for Audit Logs
CREATE OR REPLACE FUNCTION public.enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are permanent and immutable. Modification or deletion is strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_immutability();

-- 15. Notices Table
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  author TEXT NOT NULL,
  attachment_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Aid Applications Table
CREATE TABLE IF NOT EXISTS public.aid_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  type TEXT NOT NULL, -- 'education_scholarship' | 'medical_assistance' | 'emergency_relief'
  patgram_address TEXT NOT NULL,
  current_address TEXT NOT NULL,
  requested_amount NUMERIC(12, 2) NOT NULL CHECK (requested_amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewed_by TEXT,
  allocated_fund_id UUID REFERENCES public.funds(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. System Settings, Articles & Founders Configuration Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe Upgrade Columns (for pre-existing databases running updated schema.sql)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by_role user_role;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS balance_applied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.financial_corrections ADD COLUMN IF NOT EXISTS corrected_by_role user_role;
ALTER TABLE public.financial_corrections ADD COLUMN IF NOT EXISTS previous_to_fund_id UUID REFERENCES public.funds(id);
ALTER TABLE public.financial_corrections ADD COLUMN IF NOT EXISTS corrected_to_fund_id UUID REFERENCES public.funds(id);
ALTER TABLE public.financial_corrections ADD COLUMN IF NOT EXISTS previous_to_account_id UUID REFERENCES public.accounts(id);
ALTER TABLE public.financial_corrections ADD COLUMN IF NOT EXISTS corrected_to_account_id UUID REFERENCES public.accounts(id);
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.admin_permissions
  ADD COLUMN IF NOT EXISTS can_event_view_module BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_create BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_edit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_manage_categories BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_view_applications BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_approve_application BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_verify_payment BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_manage_refund BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_manage_ledger BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_delete_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_view_finance_summary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_export_reports BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_manage_settings BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_event_view_logs BOOLEAN NOT NULL DEFAULT FALSE;

-- 18. Events & Participation Module ("অনুষ্ঠান ও আয়োজন")
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'general',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  event_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled', 'archived')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  allow_pay_later BOOLEAN NOT NULL DEFAULT TRUE,
  show_participant_count BOOLEAN NOT NULL DEFAULT TRUE,
  max_capacity INT,
  payment_instructions TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_fee_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title_bn TEXT NOT NULL,
  description_bn TEXT NOT NULL DEFAULT '',
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (fee_amount >= 0),
  max_qty_per_application INT NOT NULL DEFAULT 20 CHECK (max_qty_per_application >= 1),
  priority INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_code TEXT NOT NULL UNIQUE,
  applicant_name_bn TEXT NOT NULL,
  applicant_name_en TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  organization_or_address TEXT NOT NULL DEFAULT '',
  membership_id_ref TEXT,
  category_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_participants INT NOT NULL DEFAULT 1 CHECK (total_participants >= 1),
  total_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_fee >= 0),
  application_status TEXT NOT NULL DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'submitted', 'verified', 'rejected', 'refunded', 'exempt')),
  payment_method TEXT,
  transaction_id TEXT,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (refund_amount >= 0),
  payment_note TEXT,
  refund_reason TEXT,
  notes TEXT,
  is_spot_entry BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_by_name TEXT,
  verified_at TIMESTAMPTZ,
  refunded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  refunded_by_name TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  entry_code TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('donation', 'expense')),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  party_name TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference_no TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.event_applications(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role user_role,
  actor_name TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_published_status ON public.events (is_published, status, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_categories_event ON public.event_fee_categories (event_id, priority);
CREATE INDEX IF NOT EXISTS idx_event_apps_event_status ON public.event_applications (event_id, application_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_event_apps_phone ON public.event_applications (event_id, phone);
CREATE INDEX IF NOT EXISTS idx_event_ledger_event ON public.event_ledger_entries (event_id, entry_type, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_event ON public.event_application_logs (event_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_app_txn_id
  ON public.event_applications (event_id, LOWER(TRIM(transaction_id)))
  WHERE transaction_id IS NOT NULL
    AND TRIM(transaction_id) <> ''
    AND application_status <> 'rejected';

CREATE OR REPLACE VIEW public.public_events_view AS
SELECT
  e.id, e.code, e.title, e.event_type, e.summary, e.description, e.venue,
  e.event_date, e.registration_deadline, e.status, e.is_published,
  e.registration_open, e.allow_pay_later, e.show_participant_count,
  e.max_capacity, e.payment_instructions, e.cover_image_url, e.created_at
FROM public.events e
WHERE e.is_published = TRUE AND e.status <> 'draft';

CREATE OR REPLACE VIEW public.public_event_fee_categories_view AS
SELECT
  c.id, c.event_id, c.title_bn, c.description_bn, c.fee_amount,
  c.max_qty_per_application, c.priority, c.is_active
FROM public.event_fee_categories c
JOIN public.events e ON e.id = c.event_id
WHERE c.is_active = TRUE AND e.is_published = TRUE AND e.status <> 'draft';

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aid_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current authenticated user is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper security function: Check user granular permission
CREATE OR REPLACE FUNCTION public.has_permission(p_column TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has BOOLEAN := FALSE;
BEGIN
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  EXECUTE format(
    'SELECT %I FROM public.admin_permissions WHERE user_id = $1',
    p_column
  ) INTO v_has USING auth.uid();

  RETURN COALESCE(v_has, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --- Profiles RLS ---
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin can manage all profiles" ON public.profiles;
CREATE POLICY "Super Admin can manage all profiles"
ON public.profiles FOR ALL
USING (public.is_super_admin());

-- --- Admin Permissions RLS ---
DROP POLICY IF EXISTS "Users can read own permissions" ON public.admin_permissions;
CREATE POLICY "Users can read own permissions"
ON public.admin_permissions FOR SELECT
USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin can update permissions" ON public.admin_permissions;
CREATE POLICY "Super Admin can update permissions"
ON public.admin_permissions FOR ALL
USING (public.is_super_admin());

-- --- Permission Change Logs RLS ---
DROP POLICY IF EXISTS "Super Admin can view permission change logs" ON public.permission_change_logs;
CREATE POLICY "Super Admin can view permission change logs"
ON public.permission_change_logs FOR SELECT
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin can insert permission change logs" ON public.permission_change_logs;
CREATE POLICY "Super Admin can insert permission change logs"
ON public.permission_change_logs FOR INSERT
WITH CHECK (public.is_super_admin());

-- --- Members RLS (Strictly Private & Wing-Isolated) ---
-- Public can ONLY submit pending membership application (INSERT)
DROP POLICY IF EXISTS "Public can submit membership application" ON public.members;
CREATE POLICY "Public can submit membership application"
ON public.members FOR INSERT
WITH CHECK (status = 'pending');

-- Only wing-authorized admins can view, insert, update or delete member records
DROP POLICY IF EXISTS "Authorized admins can view members" ON public.members;
CREATE POLICY "Authorized admins can view members"
ON public.members FOR SELECT
USING (
  public.is_super_admin()
  OR (type = 'student' AND public.has_permission('can_manage_student_wing'))
  OR (type <> 'student' AND public.has_permission('can_manage_members'))
);

DROP POLICY IF EXISTS "Authorized admins can insert members" ON public.members;
CREATE POLICY "Authorized admins can insert members"
ON public.members FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (type = 'student' AND public.has_permission('can_manage_student_wing'))
  OR (type <> 'student' AND public.has_permission('can_manage_members'))
);

DROP POLICY IF EXISTS "Authorized admins can update members" ON public.members;
CREATE POLICY "Authorized admins can update members"
ON public.members FOR UPDATE
USING (
  public.is_super_admin()
  OR (type = 'student' AND public.has_permission('can_manage_student_wing'))
  OR (type <> 'student' AND public.has_permission('can_manage_members'))
);

DROP POLICY IF EXISTS "Authorized admins can delete members" ON public.members;
CREATE POLICY "Authorized admins can delete members"
ON public.members FOR DELETE
USING (
  public.is_super_admin()
  OR (type = 'student' AND public.has_permission('can_manage_student_wing'))
  OR (type <> 'student' AND public.has_permission('can_manage_members'))
);

-- --- Committees & Positions RLS ---
DROP POLICY IF EXISTS "Public can view committees" ON public.committees;
CREATE POLICY "Public can view committees"
ON public.committees FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Committee managers can manage committees" ON public.committees;
CREATE POLICY "Committee managers can manage committees"
ON public.committees FOR ALL
USING (public.has_permission('can_manage_committees'));

-- Public can view committee positions only if is_published is true
DROP POLICY IF EXISTS "Public can view published positions" ON public.committee_positions;
CREATE POLICY "Public can view published positions"
ON public.committee_positions FOR SELECT
USING (is_published = TRUE OR public.has_permission('can_manage_committees'));

DROP POLICY IF EXISTS "Committee managers can manage positions" ON public.committee_positions;
CREATE POLICY "Committee managers can manage positions"
ON public.committee_positions FOR ALL
USING (public.has_permission('can_manage_committees'));

-- --- Funds & Accounts RLS ---
DROP POLICY IF EXISTS "Finance viewers can see funds" ON public.funds;
CREATE POLICY "Finance viewers can see funds"
ON public.funds FOR SELECT
USING (public.has_permission('can_view_finance'));

DROP POLICY IF EXISTS "Fund managers can manage funds" ON public.funds;
CREATE POLICY "Fund managers can manage funds"
ON public.funds FOR ALL
USING (public.has_permission('can_manage_funds'));

DROP POLICY IF EXISTS "Finance approvers can update fund balances" ON public.funds;
CREATE POLICY "Finance approvers can update fund balances"
ON public.funds FOR UPDATE
USING (public.has_permission('can_manage_funds') OR public.is_super_admin());

DROP POLICY IF EXISTS "Finance viewers can see accounts" ON public.accounts;
CREATE POLICY "Finance viewers can see accounts"
ON public.accounts FOR SELECT
USING (public.has_permission('can_view_finance'));

DROP POLICY IF EXISTS "Account managers can manage accounts" ON public.accounts;
CREATE POLICY "Account managers can manage accounts"
ON public.accounts FOR ALL
USING (public.has_permission('can_manage_accounts'));

DROP POLICY IF EXISTS "Finance approvers can update account balances" ON public.accounts;
CREATE POLICY "Finance approvers can update account balances"
ON public.accounts FOR UPDATE
USING (public.has_permission('can_manage_accounts') OR public.is_super_admin());

-- --- Transactions RLS ---
DROP POLICY IF EXISTS "Finance viewers can see transactions" ON public.transactions;
CREATE POLICY "Finance viewers can see transactions"
ON public.transactions FOR SELECT
USING (public.has_permission('can_view_finance'));

DROP POLICY IF EXISTS "Finance creators can insert transactions" ON public.transactions;
CREATE POLICY "Finance creators can insert transactions"
ON public.transactions FOR INSERT
WITH CHECK (public.has_permission('can_entry_finance'));

DROP POLICY IF EXISTS "Finance approvers can update transactions" ON public.transactions;
CREATE POLICY "Finance approvers can update transactions"
ON public.transactions FOR UPDATE
USING (public.has_permission('can_approve_finance') OR public.has_permission('can_correct_finance') OR public.is_super_admin());

DROP POLICY IF EXISTS "Finance approvers can delete pending transactions" ON public.transactions;
CREATE POLICY "Finance approvers can delete pending transactions"
ON public.transactions FOR DELETE
USING (
  (public.has_permission('can_approve_finance') OR public.has_permission('can_correct_finance') OR public.is_super_admin())
  AND status IN ('pending_approval', 'rejected')
);

-- --- Financial Corrections RLS ---
DROP POLICY IF EXISTS "Authorized can view corrections" ON public.financial_corrections;
CREATE POLICY "Authorized can view corrections"
ON public.financial_corrections FOR SELECT
USING (public.has_permission('can_view_correction_history'));

DROP POLICY IF EXISTS "Authorized can propose corrections" ON public.financial_corrections;
CREATE POLICY "Authorized can propose corrections"
ON public.financial_corrections FOR INSERT
WITH CHECK (
  (public.has_permission('can_correct_finance') OR public.is_super_admin())
  AND corrected_by = auth.uid()
);

DROP POLICY IF EXISTS "Authorized can approve corrections" ON public.financial_corrections;
CREATE POLICY "Authorized can approve corrections"
ON public.financial_corrections FOR UPDATE
USING (
  public.is_super_admin()
  OR (public.has_permission('can_approve_finance') AND corrected_by <> auth.uid())
);

-- --- Notices RLS ---
DROP POLICY IF EXISTS "Public can view notices" ON public.notices;
CREATE POLICY "Public can view notices"
ON public.notices FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Notice managers can manage notices" ON public.notices;
CREATE POLICY "Notice managers can manage notices"
ON public.notices FOR ALL
USING (public.has_permission('can_manage_notices'));

-- --- Aid Applications RLS ---
DROP POLICY IF EXISTS "Public can submit aid application" ON public.aid_applications;
CREATE POLICY "Public can submit aid application"
ON public.aid_applications FOR INSERT
WITH CHECK (status = 'submitted');

DROP POLICY IF EXISTS "Authorized can view and manage aid applications" ON public.aid_applications;
CREATE POLICY "Authorized can view and manage aid applications"
ON public.aid_applications FOR ALL
USING (
  public.has_permission('can_manage_funds')
  OR public.has_permission('can_manage_student_wing')
  OR public.is_super_admin()
);

-- --- Audit Logs RLS ---
DROP POLICY IF EXISTS "Super Admin can view audit logs" ON public.audit_logs;
CREATE POLICY "Super Admin can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.is_super_admin() OR public.has_permission('can_view_reports'));

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

-- --- System Settings RLS ---
DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
CREATE POLICY "Public can view system settings"
ON public.system_settings FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Settings managers can manage system settings" ON public.system_settings;
CREATE POLICY "Settings managers can manage system settings"
ON public.system_settings FOR ALL
USING (public.has_permission('can_manage_settings') OR public.is_super_admin());

-- ====================================================================
-- STORED PROCEDURES & INTEGRITY CHECKS
-- ====================================================================

-- Procedure to apply approved transaction balances atomically (idempotent + permission-checked)
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

-- Atomic Financial Correction RPCs (Single Transaction: Corrections + Txn Update + Dual-Balance Delta)
CREATE OR REPLACE FUNCTION public.fn_apply_txn_balance_effect(
  p_type txn_type,
  p_amount NUMERIC,
  p_fund_id UUID,
  p_account_id UUID,
  p_to_fund_id UUID,
  p_to_account_id UUID,
  p_reverse BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  v_sign NUMERIC := CASE WHEN p_reverse THEN -1 ELSE 1 END;
  v_delta NUMERIC := ROUND((p_amount * v_sign)::NUMERIC, 2);
BEGIN
  IF p_amount = 0 THEN
    RETURN;
  END IF;

  IF p_type = 'income' THEN
    UPDATE public.funds SET current_balance = current_balance + v_delta WHERE id = p_fund_id;
    UPDATE public.accounts SET current_balance = current_balance + v_delta WHERE id = p_account_id;
  ELSIF p_type = 'expense' THEN
    UPDATE public.funds SET current_balance = current_balance - v_delta WHERE id = p_fund_id;
    UPDATE public.accounts SET current_balance = current_balance - v_delta WHERE id = p_account_id;
  ELSIF p_type = 'fund_transfer' THEN
    UPDATE public.funds SET current_balance = current_balance - v_delta WHERE id = p_fund_id;
    UPDATE public.funds SET current_balance = current_balance + v_delta WHERE id = p_to_fund_id;
    UPDATE public.accounts SET current_balance = current_balance - v_delta WHERE id = p_account_id;
    UPDATE public.accounts SET current_balance = current_balance + v_delta WHERE id = p_to_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.propose_or_apply_correction_atomic(
  p_corr_id UUID,
  p_corr_code TEXT,
  p_original_txn_id UUID,
  p_corrected_amount NUMERIC,
  p_corrected_category TEXT,
  p_corrected_fund_id UUID,
  p_corrected_account_id UUID,
  p_corrected_to_fund_id UUID DEFAULT NULL,
  p_corrected_to_account_id UUID DEFAULT NULL,
  p_corrected_donor_or_payee TEXT DEFAULT NULL,
  p_corrected_description TEXT DEFAULT '',
  p_correction_reason TEXT DEFAULT '',
  p_original_snapshot JSONB DEFAULT '{}'::jsonb,
  p_corrected_snapshot JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  correction_code TEXT,
  requires_dual_approval BOOLEAN,
  approval_status correction_status
) AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_actor public.profiles%ROWTYPE;
  v_txn public.transactions%ROWTYPE;
  v_threshold NUMERIC := 30000;
  v_delta NUMERIC;
  v_is_super BOOLEAN;
  v_requires_dual BOOLEAN;
  v_status correction_status;
  v_resolved_to_fund UUID;
  v_resolved_to_account UUID;
  v_now TIMESTAMPTZ := NOW();
  v_clean_amount NUMERIC := ROUND(p_corrected_amount::NUMERIC, 2);
BEGIN
  IF v_uid IS NULL OR NOT (public.has_permission('can_correct_finance') OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'আপনার আর্থিক সংশোধন করার অনুমতি নেই।';
  END IF;

  IF LENGTH(TRIM(COALESCE(p_correction_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'আর্থিক সংশোধনের বিস্তারিত কারণ লেখা বাধ্যতামূলক (কমপক্ষে ৫ অক্ষর)।';
  END IF;

  IF v_clean_amount < 0 THEN
    RAISE EXCEPTION 'সংশোধিত পরিমাণ ঋণাত্মক হতে পারবে না।';
  END IF;

  SELECT * INTO v_actor FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_txn FROM public.transactions t WHERE t.id = p_original_txn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'মূল লেনদেন খুঁজে পাওয়া যায়নি।';
  END IF;

  IF v_txn.status NOT IN ('approved', 'corrected') THEN
    RAISE EXCEPTION 'শুধুমাত্র অনুমোদিত লেনদেনের সংশোধন প্রস্তাব করা যায়।';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_corrections fc
    WHERE fc.original_transaction_id = p_original_txn_id
      AND fc.approval_status = 'pending_approval'
  ) THEN
    RAISE EXCEPTION 'এই লেনদেনের বিপরীতে ইতোমধ্যে একটি সংশোধনী অনুমোদনের অপেক্ষায় রয়েছে।';
  END IF;

  SELECT COALESCE(NULLIF(config->>'correctionThresholdAmount', '')::NUMERIC, 30000)
  INTO v_threshold
  FROM public.system_settings
  WHERE id = 'default';

  v_delta := ROUND(ABS(v_clean_amount - v_txn.amount)::NUMERIC, 2);
  v_is_super := public.is_super_admin();
  v_requires_dual := (NOT v_is_super) AND (v_delta > v_threshold);
  v_status := CASE WHEN v_requires_dual THEN 'pending_approval'::correction_status ELSE 'approved'::correction_status END;

  v_resolved_to_fund := CASE WHEN v_txn.type = 'fund_transfer' THEN COALESCE(p_corrected_to_fund_id, v_txn.to_fund_id) ELSE NULL END;
  v_resolved_to_account := CASE WHEN v_txn.type = 'fund_transfer' THEN COALESCE(p_corrected_to_account_id, v_txn.to_account_id) ELSE NULL END;

  IF v_txn.type = 'fund_transfer' AND (v_resolved_to_fund IS NULL OR v_resolved_to_account IS NULL) THEN
    RAISE EXCEPTION 'ফান্ড স্থানান্তর সংশোধনের জন্য গন্তব্য তহবিল ও অ্যাকাউন্ট আবশ্যক।';
  END IF;

  INSERT INTO public.financial_corrections (
    id, correction_code, original_transaction_id,
    previous_amount, corrected_amount,
    previous_category, corrected_category,
    previous_fund_id, corrected_fund_id,
    previous_account_id, corrected_account_id,
    previous_to_fund_id, corrected_to_fund_id,
    previous_to_account_id, corrected_to_account_id,
    original_snapshot, corrected_snapshot, correction_reason,
    requires_dual_approval, approval_status,
    corrected_by, corrected_by_role, approved_by, approved_at, created_at
  ) VALUES (
    COALESCE(p_corr_id, uuid_generate_v4()),
    p_corr_code,
    p_original_txn_id,
    v_txn.amount, v_clean_amount,
    v_txn.category, COALESCE(NULLIF(TRIM(p_corrected_category), ''), v_txn.category),
    v_txn.fund_id, p_corrected_fund_id,
    v_txn.account_id, p_corrected_account_id,
    v_txn.to_fund_id, v_resolved_to_fund,
    v_txn.to_account_id, v_resolved_to_account,
    p_original_snapshot, p_corrected_snapshot, TRIM(p_correction_reason),
    v_requires_dual, v_status,
    v_uid, v_actor.role,
    CASE WHEN v_status = 'approved' THEN v_uid ELSE NULL END,
    CASE WHEN v_status = 'approved' THEN v_now ELSE NULL END,
    v_now
  )
  RETURNING financial_corrections.id, financial_corrections.correction_code
  INTO p_corr_id, p_corr_code;

  IF v_status = 'approved' THEN
    PERFORM public.fn_apply_txn_balance_effect(
      v_txn.type, v_txn.amount, v_txn.fund_id, v_txn.account_id, v_txn.to_fund_id, v_txn.to_account_id, TRUE
    );
    PERFORM public.fn_apply_txn_balance_effect(
      v_txn.type, v_clean_amount, p_corrected_fund_id, p_corrected_account_id, v_resolved_to_fund, v_resolved_to_account, FALSE
    );

    UPDATE public.transactions t
    SET amount = v_clean_amount,
        category = COALESCE(NULLIF(TRIM(p_corrected_category), ''), v_txn.category),
        fund_id = p_corrected_fund_id,
        account_id = p_corrected_account_id,
        to_fund_id = v_resolved_to_fund,
        to_account_id = v_resolved_to_account,
        donor_or_payee = COALESCE(NULLIF(TRIM(p_corrected_donor_or_payee), ''), v_txn.donor_or_payee),
        description = COALESCE(TRIM(p_corrected_description), v_txn.description),
        status = 'corrected'
    WHERE t.id = p_original_txn_id;
  END IF;

  RETURN QUERY SELECT p_corr_id, p_corr_code, v_requires_dual, v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.propose_or_apply_correction_atomic(
  UUID, TEXT, UUID, NUMERIC, TEXT, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_correction_atomic(
  p_corr_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_corr public.financial_corrections%ROWTYPE;
  v_txn public.transactions%ROWTYPE;
  v_to_fund UUID;
  v_to_account UUID;
  v_donor TEXT;
  v_desc TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_permission('can_approve_finance') OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'আপনার আর্থিক সংশোধন অনুমোদনের অনুমতি নেই।';
  END IF;

  SELECT * INTO v_corr FROM public.financial_corrections fc WHERE fc.id = p_corr_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'সংশোধনী রেকর্ড খুঁজে পাওয়া যায়নি।';
  END IF;

  IF v_corr.approval_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'সংশোধনীটি অনুমোদনের অপেক্ষায় নেই।';
  END IF;

  IF v_corr.corrected_by = v_uid AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'যিনি সংশোধন প্রস্তাব করেছেন তিনি নিজে এটি অনুমোদন করতে পারবেন না; অন্য দায়িত্বপ্রাপ্তের অনুমোদন প্রয়োজন।';
  END IF;

  SELECT * INTO v_txn FROM public.transactions t WHERE t.id = v_corr.original_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'মূল লেনদেন খুঁজে পাওয়া যায়নি।';
  END IF;

  v_to_fund := COALESCE(
    v_corr.corrected_to_fund_id,
    NULLIF(v_corr.corrected_snapshot->>'toFundId', '')::UUID,
    v_txn.to_fund_id
  );
  v_to_account := COALESCE(
    v_corr.corrected_to_account_id,
    NULLIF(v_corr.corrected_snapshot->>'toAccountId', '')::UUID,
    v_txn.to_account_id
  );
  v_donor := COALESCE(NULLIF(TRIM(v_corr.corrected_snapshot->>'donorOrPayee'), ''), v_txn.donor_or_payee);
  v_desc := COALESCE(v_corr.corrected_snapshot->>'description', v_txn.description);

  PERFORM public.fn_apply_txn_balance_effect(
    v_txn.type, v_txn.amount, v_txn.fund_id, v_txn.account_id, v_txn.to_fund_id, v_txn.to_account_id, TRUE
  );
  PERFORM public.fn_apply_txn_balance_effect(
    v_txn.type, v_corr.corrected_amount, v_corr.corrected_fund_id, v_corr.corrected_account_id, v_to_fund, v_to_account, FALSE
  );

  UPDATE public.financial_corrections fc
  SET approval_status = 'approved',
      approved_by = v_uid,
      approved_at = v_now,
      approval_note = p_note
  WHERE fc.id = p_corr_id;

  UPDATE public.transactions t
  SET amount = v_corr.corrected_amount,
      category = v_corr.corrected_category,
      fund_id = v_corr.corrected_fund_id,
      account_id = v_corr.corrected_account_id,
      to_fund_id = CASE WHEN v_txn.type = 'fund_transfer' THEN v_to_fund ELSE NULL END,
      to_account_id = CASE WHEN v_txn.type = 'fund_transfer' THEN v_to_account ELSE NULL END,
      donor_or_payee = v_donor,
      description = v_desc,
      status = 'corrected'
  WHERE t.id = v_txn.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_correction_atomic(UUID, TEXT) TO authenticated;

-- Procedure to verify that Total Funds Balance equals Total Accounts Balance
CREATE OR REPLACE FUNCTION public.fn_verify_dual_balance_integrity()
RETURNS TABLE (
  total_funds NUMERIC,
  total_accounts NUMERIC,
  is_matched BOOLEAN,
  discrepancy NUMERIC
) AS $$
DECLARE
  v_funds NUMERIC := 0;
  v_accounts NUMERIC := 0;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND NOT (
       public.has_permission('can_view_finance')
       OR public.has_permission('can_view_reports')
       OR public.is_super_admin()
     ) THEN
    RAISE EXCEPTION 'Permission denied: financial integrity check requires finance authorization.';
  END IF;

  SELECT COALESCE(SUM(current_balance), 0) INTO v_funds FROM public.funds;
  SELECT COALESCE(SUM(current_balance), 0) INTO v_accounts FROM public.accounts;

  RETURN QUERY SELECT 
    v_funds, 
    v_accounts, 
    (v_funds = v_accounts), 
    ABS(v_funds - v_accounts);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Safe directory helper so non-super-admins see officer names instead of raw UUIDs
CREATE OR REPLACE FUNCTION public.get_officer_directory_names()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role user_role
) AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.role
  FROM public.profiles p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_officer_directory_names() TO authenticated;

-- Super Admin atomic clean production reset (keeps profiles, permissions, settings, immutable audit logs)
CREATE OR REPLACE FUNCTION public.reset_clean_production_atomic()
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: Only active Super Admin can reset production data.';
  END IF;

  DELETE FROM public.financial_corrections;
  DELETE FROM public.transactions;
  DELETE FROM public.event_application_logs;
  DELETE FROM public.event_ledger_entries;
  DELETE FROM public.event_applications;
  DELETE FROM public.event_fee_categories;
  DELETE FROM public.events;
  DELETE FROM public.aid_applications;
  DELETE FROM public.notices;
  DELETE FROM public.committee_positions;
  DELETE FROM public.committees;
  DELETE FROM public.members;

  UPDATE public.funds SET current_balance = 0.00;
  UPDATE public.accounts SET current_balance = 0.00;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reset_clean_production_atomic() TO authenticated;

-- Atomic Public Member Application RPC (Issues Temporary Tracking ID; Serial assigned ONLY on Admin Approval)
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

-- Atomic Member Approval RPC (Assigns official PKS-GEN / PKS-STU serial only when approved)
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

  IF v_member.type = 'student' THEN
    SELECT COALESCE(NULLIF(TRIM(config->>'memberIdPrefixStudent'), ''), 'PKS-STU')
    INTO v_prefix
    FROM public.system_settings
    WHERE id = 'default';
    v_prefix := COALESCE(v_prefix, 'PKS-STU');
  ELSE
    SELECT COALESCE(NULLIF(TRIM(config->>'memberIdPrefixGeneral'), ''), 'PKS-GEN')
    INTO v_prefix
    FROM public.system_settings
    WHERE id = 'default';
    v_prefix := COALESCE(v_prefix, 'PKS-GEN');
  END IF;

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

-- ====================================================================
-- FIRST SUPER ADMIN AUTO-BOOTSTRAP & OFFICER REGISTRATION TRIGGER
-- ====================================================================

-- Safe check for frontend login screen: returns TRUE only when 0 profiles exist
CREATE OR REPLACE FUNCTION public.is_first_admin_setup()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_first_admin_setup() TO anon, authenticated;

-- Automatically creates profile & permissions on Supabase Auth signup:
-- 1st user ever becomes 'super_admin' (active, full permissions)
-- Subsequent users become 'pending_approval' until Super Admin approves them
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
    IF v_req_role IN ('finance_secretary', 'president', 'general_secretary', 'general_admin', 'student_admin', 'event_admin') THEN
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
    can_manage_notices, can_manage_settings, can_export_backup,
    can_event_view_module, can_event_create, can_event_edit,
    can_event_manage_categories, can_event_view_applications, can_event_approve_application,
    can_event_verify_payment, can_event_manage_refund, can_event_manage_ledger,
    can_event_delete_test_data, can_event_view_finance_summary, can_event_export_reports,
    can_event_manage_settings, can_event_view_logs
  ) VALUES (
    NEW.id,
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Self-healing RPC: returns caller's profile or safely creates it if user existed before schema setup
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
    IF v_req_role IN ('finance_secretary', 'president', 'general_secretary', 'general_admin', 'student_admin', 'event_admin') THEN
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
    can_manage_notices, can_manage_settings, can_export_backup,
    can_event_view_module, can_event_create, can_event_edit,
    can_event_manage_categories, can_event_view_applications, can_event_approve_application,
    can_event_verify_payment, can_event_manage_refund, can_event_manage_ledger,
    can_event_delete_test_data, can_event_view_finance_summary, can_event_export_reports,
    can_event_manage_settings, can_event_view_logs
  ) VALUES (
    v_user.id,
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin')
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.sync_or_bootstrap_profile() TO authenticated;

-- Auto-confirm email in auth.users whenever Super Admin approves an officer profile
-- so approved officers can immediately log in using their registered email & password
CREATE OR REPLACE FUNCTION public.sync_auth_confirm_on_profile_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    BEGIN
      UPDATE auth.users
      SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
      WHERE id = NEW.id AND email_confirmed_at IS NULL;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_auth_confirm_on_active ON public.profiles;
CREATE TRIGGER trg_sync_auth_confirm_on_active
AFTER UPDATE OF status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_confirm_on_profile_active();

-- Explicit Super Admin officer approval/update RPC (updates role/status & confirms email atomically)
CREATE OR REPLACE FUNCTION public.approve_officer_profile(
  p_user_id UUID,
  p_role user_role DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: Only Super Admin can manage officer accounts.';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Officer profile not found.';
  END IF;

  UPDATE public.profiles
  SET role = COALESCE(p_role, role),
      status = COALESCE(NULLIF(TRIM(p_status), ''), status),
      updated_at = NOW()
  WHERE id = p_user_id;

  IF COALESCE(NULLIF(TRIM(p_status), ''), v_target.status) = 'active' THEN
    BEGIN
      UPDATE auth.users
      SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
      WHERE id = p_user_id AND email_confirmed_at IS NULL;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_officer_profile(UUID, user_role, TEXT) TO authenticated;

-- Backfill confirmation for any officer already marked active before this trigger existed
DO $$
BEGIN
  UPDATE auth.users u
  SET email_confirmed_at = COALESCE(u.email_confirmed_at, NOW())
  FROM public.profiles p
  WHERE u.id = p.id AND p.status = 'active' AND u.email_confirmed_at IS NULL;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- Safe non-super-admin / test officer deletion RPC
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

-- Event Module Public RPCs & RLS Policies ("অনুষ্ঠান ও আয়োজন")
CREATE OR REPLACE FUNCTION public.get_public_event_counts()
RETURNS TABLE (
  event_id UUID,
  total_participants BIGINT,
  approved_participants BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS event_id,
    COALESCE(SUM(CASE WHEN a.application_status IN ('pending', 'approved') THEN a.total_participants ELSE 0 END), 0)::BIGINT AS total_participants,
    COALESCE(SUM(CASE WHEN a.application_status = 'approved' THEN a.total_participants ELSE 0 END), 0)::BIGINT AS approved_participants
  FROM public.events e
  LEFT JOIN public.event_applications a ON a.event_id = e.id
  WHERE e.is_published = TRUE
    AND e.status <> 'draft'
    AND e.show_participant_count = TRUE
  GROUP BY e.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_public_event_counts() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_event_application(
  p_event_id UUID,
  p_applicant_name_bn TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_organization_or_address TEXT DEFAULT '',
  p_membership_id_ref TEXT DEFAULT NULL,
  p_quantities JSONB DEFAULT '[]'::jsonb,
  p_payment_method TEXT DEFAULT NULL,
  p_transaction_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  registration_code TEXT,
  total_participants INT,
  total_fee NUMERIC,
  application_status TEXT,
  payment_status TEXT
) AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_item JSONB;
  v_cat public.event_fee_categories%ROWTYPE;
  v_qty INT;
  v_line_total NUMERIC;
  v_breakdown JSONB := '[]'::jsonb;
  v_total_participants INT := 0;
  v_total_fee NUMERIC := 0;
  v_clean_txn TEXT := NULLIF(TRIM(COALESCE(p_transaction_id, '')), '');
  v_clean_method TEXT := NULLIF(TRIM(COALESCE(p_payment_method, '')), '');
  v_pay_status TEXT := 'unpaid';
  v_paid_amt NUMERIC := 0;
  v_year TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_reg_code TEXT;
  v_new_id UUID;
  v_current_headcount INT := 0;
BEGIN
  IF TRIM(COALESCE(p_applicant_name_bn, '')) = '' OR TRIM(COALESCE(p_phone, '')) = '' THEN
    RAISE EXCEPTION 'আবেদনকারীর নাম ও মোবাইল নম্বর দেওয়া বাধ্যতামূলক।';
  END IF;

  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'অনুষ্ঠানটি খুঁজে পাওয়া যায়নি।';
  END IF;

  IF NOT v_event.is_published OR NOT v_event.registration_open OR v_event.status NOT IN ('upcoming', 'ongoing') THEN
    RAISE EXCEPTION 'এই অনুষ্ঠানের নিবন্ধন বর্তমানে বন্ধ রয়েছে।';
  END IF;

  IF v_event.registration_deadline IS NOT NULL AND NOW() > v_event.registration_deadline THEN
    RAISE EXCEPTION 'এই অনুষ্ঠানের নিবন্ধনের সময়সীমা শেষ হয়ে গেছে।';
  END IF;

  IF jsonb_typeof(p_quantities) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_quantities)
    LOOP
      v_qty := COALESCE((v_item->>'quantity')::INT, 0);
      IF v_qty > 0 THEN
        SELECT * INTO v_cat
        FROM public.event_fee_categories c
        WHERE c.id = (v_item->>'category_id')::UUID
          AND c.event_id = p_event_id
          AND c.is_active = TRUE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'নির্বাচিত অংশগ্রহণের ক্যাটাগরি সঠিক নয়।';
        END IF;

        IF v_qty > v_cat.max_qty_per_application THEN
          RAISE EXCEPTION 'একটি আবেদনে "%" ক্যাটাগরিতে সর্বোচ্চ % জন দেওয়া যাবে।', v_cat.title_bn, v_cat.max_qty_per_application;
        END IF;

        v_line_total := ROUND((v_cat.fee_amount * v_qty)::NUMERIC, 2);
        v_total_participants := v_total_participants + v_qty;
        v_total_fee := ROUND((v_total_fee + v_line_total)::NUMERIC, 2);

        v_breakdown := v_breakdown || jsonb_build_array(
          jsonb_build_object(
            'categoryId', v_cat.id,
            'titleBn', v_cat.title_bn,
            'unitFee', v_cat.fee_amount,
            'quantity', v_qty,
            'lineTotal', v_line_total
          )
        );
      END IF;
    END LOOP;
  END IF;

  IF v_total_participants < 1 THEN
    RAISE EXCEPTION 'অন্তত ১ জন অংশগ্রহণকারীর সংখ্যা নির্বাচন করুন।';
  END IF;

  IF v_event.max_capacity IS NOT NULL AND v_event.max_capacity > 0 THEN
    SELECT COALESCE(SUM(ea.total_participants), 0)
    INTO v_current_headcount
    FROM public.event_applications ea
    WHERE ea.event_id = p_event_id
      AND ea.application_status IN ('pending', 'approved');

    IF (v_current_headcount + v_total_participants) > v_event.max_capacity THEN
      RAISE EXCEPTION 'দুঃখিত! এই অনুষ্ঠানের নির্ধারিত সর্বোচ্চ আসন সংখ্যা (% জন) পূর্ণ হয়ে গেছে (বাকি আসন: % জন)।',
        v_event.max_capacity,
        GREATEST(0, v_event.max_capacity - v_current_headcount);
    END IF;
  END IF;

  IF v_total_fee = 0 THEN
    v_pay_status := 'exempt';
    v_clean_method := NULL;
    v_clean_txn := NULL;
    v_paid_amt := 0;
  ELSIF v_clean_txn IS NOT NULL OR v_clean_method IS NOT NULL THEN
    IF v_clean_txn IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.event_applications ea
      WHERE ea.event_id = p_event_id
        AND ea.application_status <> 'rejected'
        AND ea.transaction_id IS NOT NULL
        AND LOWER(TRIM(ea.transaction_id)) = LOWER(v_clean_txn)
    ) THEN
      RAISE EXCEPTION 'এই ট্রানজেকশন আইডি / রসিদ নম্বর (%) ইতোমধ্যে এই অনুষ্ঠানে ব্যবহৃত হয়েছে।', v_clean_txn;
    END IF;
    v_pay_status := 'submitted';
    v_paid_amt := v_total_fee;
  ELSE
    IF NOT v_event.allow_pay_later THEN
      RAISE EXCEPTION 'এই অনুষ্ঠানে নিবন্ধনের সাথে পেমেন্ট তথ্য দেওয়া বাধ্যতামূলক।';
    END IF;
    v_pay_status := 'unpaid';
    v_paid_amt := 0;
  END IF;

  PERFORM pg_advisory_xact_lock(77665548);
  v_reg_code := 'EVT-' || v_year || '-' || LPAD((FLOOR(100000 + RANDOM() * 899999))::INT::TEXT, 6, '0');
  WHILE EXISTS (SELECT 1 FROM public.event_applications a WHERE a.registration_code = v_reg_code) LOOP
    v_reg_code := 'EVT-' || v_year || '-' || LPAD((FLOOR(100000 + RANDOM() * 899999))::INT::TEXT, 6, '0');
  END LOOP;

  BEGIN
    INSERT INTO public.event_applications (
      event_id, registration_code, applicant_name_bn, phone, email,
      organization_or_address, membership_id_ref, category_breakdown,
      total_participants, total_fee, application_status, payment_status,
      payment_method, transaction_id, paid_amount, notes, is_spot_entry
    )
    VALUES (
      p_event_id, v_reg_code, TRIM(p_applicant_name_bn), TRIM(p_phone),
      NULLIF(TRIM(COALESCE(p_email, '')), ''),
      TRIM(COALESCE(p_organization_or_address, '')),
      NULLIF(TRIM(COALESCE(p_membership_id_ref, '')), ''),
      v_breakdown, v_total_participants, v_total_fee, 'pending', v_pay_status,
      v_clean_method, v_clean_txn, v_paid_amt,
      NULLIF(TRIM(COALESCE(p_notes, '')), ''), FALSE
    )
    RETURNING event_applications.id INTO v_new_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'এই ট্রানজেকশন আইডি / রসিদ নম্বরটি ইতোমধ্যে এই অনুষ্ঠানে ব্যবহৃত হয়েছে।';
  END;

  RETURN QUERY SELECT v_new_id, v_reg_code, v_total_participants, v_total_fee, 'pending'::TEXT, v_pay_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.submit_public_event_application(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lookup_event_registration_status(
  p_registration_code TEXT,
  p_phone TEXT
)
RETURNS TABLE (
  registration_code TEXT,
  event_title TEXT,
  applicant_name_bn TEXT,
  total_participants INT,
  total_fee NUMERIC,
  application_status TEXT,
  payment_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.registration_code, e.title AS event_title, a.applicant_name_bn,
    a.total_participants, a.total_fee, a.application_status,
    a.payment_status, a.created_at
  FROM public.event_applications a
  JOIN public.events e ON e.id = a.event_id
  WHERE LOWER(TRIM(a.registration_code)) = LOWER(TRIM(COALESCE(p_registration_code, '')))
    AND REGEXP_REPLACE(a.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_event_registration_status(TEXT, TEXT) TO anon, authenticated;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_application_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published events" ON public.events;
CREATE POLICY "Public can view published events"
ON public.events FOR SELECT
USING ((is_published = TRUE AND status <> 'draft') OR public.has_permission('can_event_view_module') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized event admins can insert events" ON public.events;
CREATE POLICY "Authorized event admins can insert events"
ON public.events FOR INSERT
WITH CHECK (public.has_permission('can_event_create') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized event admins can update events" ON public.events;
CREATE POLICY "Authorized event admins can update events"
ON public.events FOR UPDATE
USING (public.has_permission('can_event_edit') OR public.has_permission('can_event_manage_settings') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized event admins can delete draft or test events" ON public.events;
CREATE POLICY "Authorized event admins can delete draft or test events"
ON public.events FOR DELETE
USING (public.has_permission('can_event_delete_test_data') OR public.is_super_admin());

DROP POLICY IF EXISTS "Public can view active categories of published events" ON public.event_fee_categories;
CREATE POLICY "Public can view active categories of published events"
ON public.event_fee_categories FOR SELECT
USING (
  (is_active = TRUE AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_published = TRUE AND e.status <> 'draft'))
  OR public.has_permission('can_event_view_module')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Authorized admins can manage event categories" ON public.event_fee_categories;
CREATE POLICY "Authorized admins can manage event categories"
ON public.event_fee_categories FOR ALL
USING (public.has_permission('can_event_manage_categories') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can view event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can view event applications"
ON public.event_applications FOR SELECT
USING (public.has_permission('can_event_view_applications') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can insert spot event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can insert spot event applications"
ON public.event_applications FOR INSERT
WITH CHECK (public.has_permission('can_event_approve_application') OR public.has_permission('can_event_verify_payment') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can update event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can update event applications"
ON public.event_applications FOR UPDATE
USING (public.has_permission('can_event_approve_application') OR public.has_permission('can_event_verify_payment') OR public.has_permission('can_event_manage_refund') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can delete test event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can delete test event applications"
ON public.event_applications FOR DELETE
USING (public.has_permission('can_event_delete_test_data') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can view event ledger" ON public.event_ledger_entries;
CREATE POLICY "Authorized admins can view event ledger"
ON public.event_ledger_entries FOR SELECT
USING (public.has_permission('can_event_view_finance_summary') OR public.has_permission('can_event_manage_ledger') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can manage event ledger" ON public.event_ledger_entries;
CREATE POLICY "Authorized admins can manage event ledger"
ON public.event_ledger_entries FOR ALL
USING (public.has_permission('can_event_manage_ledger') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can view event logs" ON public.event_application_logs;
CREATE POLICY "Authorized admins can view event logs"
ON public.event_application_logs FOR SELECT
USING (public.has_permission('can_event_view_logs') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated event admins can insert event logs" ON public.event_application_logs;
CREATE POLICY "Authenticated event admins can insert event logs"
ON public.event_application_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.has_permission('can_event_view_module')
    OR public.has_permission('can_event_approve_application')
    OR public.has_permission('can_event_verify_payment')
    OR public.has_permission('can_event_manage_refund')
    OR public.has_permission('can_event_manage_ledger')
    OR public.is_super_admin()
  )
);

-- Explicit schema, table, view, and sequence grants (RLS enforces row-level authorization)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.notices, public.committees, public.public_committee_members, public.system_settings, public.public_events_view, public.public_event_fee_categories_view TO anon, authenticated;
GRANT INSERT ON public.members, public.aid_applications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Backfill any pre-existing auth.users that do not yet have a public.profiles row
DO $$
DECLARE
  v_rec RECORD;
  v_has_super BOOLEAN;
  v_role user_role;
  v_status TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'super_admin' AND status = 'active'
  ) INTO v_has_super;

  FOR v_rec IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
    ORDER BY au.created_at ASC
  LOOP
    IF NOT v_has_super THEN
      v_role := 'super_admin';
      v_status := 'active';
      v_has_super := TRUE;
    ELSE
      v_role := 'general_admin';
      v_status := 'pending_approval';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, status)
    VALUES (
      v_rec.id,
      COALESCE(v_rec.email, ''),
      COALESCE(NULLIF(TRIM(v_rec.raw_user_meta_data->>'full_name'), ''), v_rec.email, 'অ্যাডমিন'),
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
      can_manage_notices, can_manage_settings, can_export_backup,
      can_event_view_module, can_event_create, can_event_edit,
      can_event_manage_categories, can_event_view_applications, can_event_approve_application,
      can_event_verify_payment, can_event_manage_refund, can_event_manage_ledger,
      can_event_delete_test_data, can_event_view_finance_summary, can_event_export_reports,
      can_event_manage_settings, can_event_view_logs
    ) VALUES (
      v_rec.id,
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
      (v_role = 'super_admin'), (v_role = 'super_admin')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;

-- ====================================================================
-- INITIAL SEED DATA (FUNDS & ACCOUNTS - CLEAN 0.00 STARTING BALANCES)
-- ====================================================================

INSERT INTO public.funds (name, code, description, current_balance, is_active, is_default)
VALUES
  ('সাধারণ পরিচালন তহবিল', 'GEN', 'সংগঠনের সার্বিক প্রশাসনিক ও সাধারণ ব্যয় নির্বাহের মূল তহবিল।', 0.00, TRUE, TRUE),
  ('শিক্ষা ও মেধা বৃত্তি তহবিল', 'EDU', 'পাটগ্রামের অস্বচ্ছল ও মেধাবী শিক্ষার্থীদের মাসিক উপবৃত্তি ও এককালীন অনুদান।', 0.00, TRUE, FALSE),
  ('চিকিৎসা সহায়তা তহবিল', 'MED', 'দুরারোগ্য ব্যাধিতে আক্রান্ত ও জরুরি চিকিৎসার জন্য আর্থিক অনুদান তহবিল।', 0.00, TRUE, FALSE),
  ('জরুরি দুর্যোগ ও ত্রাণ তহবিল', 'RELIEF', 'শীতবস্ত্র বিতরণ, বন্যা ও জরুরি প্রাকৃতিক দুর্যোগে দ্রুত সহায়তার বিশেষ তহবিল।', 0.00, TRUE, FALSE),
  ('সামাজিক ও যুব কল্যাণ তহবিল', 'SOC', 'কমিউনিটি উন্নয়ন, ক্রীড়া ও পাঠাগার সংক্রান্ত কার্যক্রম তহবিল।', 0.00, TRUE, FALSE),
  ('ছাত্র সংগঠন কল্যাণ তহবিল', 'STU', 'পাটগ্রাম ছাত্র কল্যাণ সমিতি রংপুর-এর নিজস্ব কর্মসূচি ও সভা সংক্রান্ত তহবিল।', 0.00, TRUE, FALSE),
  ('স্থায়ী আমানত ও রিজার্ভ তহবিল', 'RES', 'সংগঠনের দীর্ঘমেয়াদি স্থায়িত্ব ও ভবিষ্যৎ নিজস্ব কার্যালয় প্রতিষ্ঠার সংরক্ষিত তহবিল।', 0.00, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.accounts (name, type, account_number, current_balance, is_active)
VALUES
  ('ব্যাংক অ্যাকাউন্ট (প্রধান তহবিল)', 'bank', 'PENDING-SETUP', 0.00, TRUE),
  ('হাতে নগদ ক্যাশ (কোষাধ্যক্ষ)', 'cash', 'CASH-IN-HAND', 0.00, TRUE),
  ('মোবাইল ব্যাংকিং ওয়ালেট (বিকাশ / নগদ)', 'mobile_banking', '01603526000', 0.00, TRUE)
ON CONFLICT (name) DO NOTHING;
