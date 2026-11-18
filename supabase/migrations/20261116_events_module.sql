-- ====================================================================
-- পাটগ্রাম কল্যাণ সমিতি, রংপুর — অনুমোদিত ও নিরাপদ অ্যাডিটিভ মাইগ্রেশন
-- Module: "অনুষ্ঠান ও আয়োজন" (Events & Participation + Dedicated Event Ledger)
-- Date: 2026-11-16
-- Safe to run on EXISTING live Supabase databases (zero data deletion).
-- Note: Do NOT wrap in explicit BEGIN/COMMIT so ALTER TYPE ADD VALUE commits cleanly.
-- ====================================================================

-- 1. Add 'event_admin' to user_role enum safely (outside transaction block)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'event_admin';

-- 2. Add 14 granular Event permissions to public.admin_permissions
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

-- Grant full 14 event permissions to existing active super_admin accounts automatically
UPDATE public.admin_permissions ap
SET
  can_event_view_module = TRUE,
  can_event_create = TRUE,
  can_event_edit = TRUE,
  can_event_manage_categories = TRUE,
  can_event_view_applications = TRUE,
  can_event_approve_application = TRUE,
  can_event_verify_payment = TRUE,
  can_event_manage_refund = TRUE,
  can_event_manage_ledger = TRUE,
  can_event_delete_test_data = TRUE,
  can_event_view_finance_summary = TRUE,
  can_event_export_reports = TRUE,
  can_event_manage_settings = TRUE,
  can_event_view_logs = TRUE,
  updated_at = NOW()
FROM public.profiles p
WHERE p.id = ap.user_id
  AND p.role = 'super_admin';

-- 3. Update handle_new_user() trigger & sync_or_bootstrap_profile() to support event_admin & 14 columns
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

-- 4. Events Table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE, -- e.g. EVT-2026-001
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'general', -- 'reunion' | 'iftar' | 'picnic' | 'agm' | 'seminar' | 'welfare' | 'general'
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

-- 5. Event Fee Categories Table (Dynamic per-event categories, supports ৳0 Free)
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

-- 6. Event Applications & Registrations Table (Zero Image Upload, Frozen Snapshot, Separate Statuses)
CREATE TABLE IF NOT EXISTS public.event_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_code TEXT NOT NULL UNIQUE, -- e.g. REG-2026-0001
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
  payment_method TEXT, -- 'bkash' | 'nagad' | 'rocket' | 'bank' | 'cash' | 'other' | NULL
  transaction_id TEXT, -- Optional at registration; unique per event when present
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

-- 7. Dedicated Event Finance Ledger Table (100% Isolated from Main Association Finance)
-- Records manual Donor/Sponsor Grants, Spot Donations & Event Expenses per Event.
-- Registration fees & refunds are computed from event_applications to guarantee zero double-counting.
CREATE TABLE IF NOT EXISTS public.event_ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  entry_code TEXT NOT NULL UNIQUE, -- e.g. EVL-2026-0001
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

-- 8. Event Activity & Audit Logs Table
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

-- 9. Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_events_published_status ON public.events (is_published, status, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_categories_event ON public.event_fee_categories (event_id, priority);
CREATE INDEX IF NOT EXISTS idx_event_apps_event_status ON public.event_applications (event_id, application_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_event_apps_phone ON public.event_applications (event_id, phone);
CREATE INDEX IF NOT EXISTS idx_event_ledger_event ON public.event_ledger_entries (event_id, entry_type, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_event ON public.event_application_logs (event_id, created_at DESC);

-- Prevent duplicate non-empty transaction_id within the same event (ignoring rejected apps)
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_app_txn_id
  ON public.event_applications (event_id, LOWER(TRIM(transaction_id)))
  WHERE transaction_id IS NOT NULL
    AND TRIM(transaction_id) <> ''
    AND application_status <> 'rejected';

-- 10. Public Non-PII Views (Zero Phone, Email, or Txn ID exposure!)
CREATE OR REPLACE VIEW public.public_events_view AS
SELECT
  e.id,
  e.code,
  e.title,
  e.event_type,
  e.summary,
  e.description,
  e.venue,
  e.event_date,
  e.registration_deadline,
  e.status,
  e.is_published,
  e.registration_open,
  e.allow_pay_later,
  e.show_participant_count,
  e.max_capacity,
  e.payment_instructions,
  e.cover_image_url,
  e.created_at
FROM public.events e
WHERE e.is_published = TRUE AND e.status <> 'draft';

CREATE OR REPLACE VIEW public.public_event_fee_categories_view AS
SELECT
  c.id,
  c.event_id,
  c.title_bn,
  c.description_bn,
  c.fee_amount,
  c.max_qty_per_application,
  c.priority,
  c.is_active
FROM public.event_fee_categories c
JOIN public.events e ON e.id = c.event_id
WHERE c.is_active = TRUE
  AND e.is_published = TRUE
  AND e.status <> 'draft';

-- 11. Public Safe Aggregate Counts RPC (returns only anonymous headcounts when show_participant_count = TRUE)
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

-- 12. Atomic Public Event Registration RPC (Server-side frozen fee snapshot, optional payment)
CREATE OR REPLACE FUNCTION public.submit_public_event_application(
  p_event_id UUID,
  p_applicant_name_bn TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_organization_or_address TEXT DEFAULT '',
  p_membership_id_ref TEXT DEFAULT NULL,
  p_quantities JSONB DEFAULT '[]'::jsonb, -- Array of { "category_id": UUID, "quantity": INT }
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

  -- Build frozen category snapshot & compute server-authoritative totals
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

  -- Payment status decision (Attendance-first, optional payment)
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
      event_id,
      registration_code,
      applicant_name_bn,
      phone,
      email,
      organization_or_address,
      membership_id_ref,
      category_breakdown,
      total_participants,
      total_fee,
      application_status,
      payment_status,
      payment_method,
      transaction_id,
      paid_amount,
      notes,
      is_spot_entry
    )
    VALUES (
      p_event_id,
      v_reg_code,
      TRIM(p_applicant_name_bn),
      TRIM(p_phone),
      NULLIF(TRIM(COALESCE(p_email, '')), ''),
      TRIM(COALESCE(p_organization_or_address, '')),
      NULLIF(TRIM(COALESCE(p_membership_id_ref, '')), ''),
      v_breakdown,
      v_total_participants,
      v_total_fee,
      'pending',
      v_pay_status,
      v_clean_method,
      v_clean_txn,
      v_paid_amt,
      NULLIF(TRIM(COALESCE(p_notes, '')), ''),
      FALSE
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

-- 13. Own Registration Status Self-Lookup RPC (Requires exact BOTH registration_code AND phone)
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
    a.registration_code,
    e.title AS event_title,
    a.applicant_name_bn,
    a.total_participants,
    a.total_fee,
    a.application_status,
    a.payment_status,
    a.created_at
  FROM public.event_applications a
  JOIN public.events e ON e.id = a.event_id
  WHERE LOWER(TRIM(a.registration_code)) = LOWER(TRIM(COALESCE(p_registration_code, '')))
    AND REGEXP_REPLACE(a.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_event_registration_status(TEXT, TEXT) TO anon, authenticated;

-- 14. Row Level Security (RLS) for Event Tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_application_logs ENABLE ROW LEVEL SECURITY;

-- Events RLS
DROP POLICY IF EXISTS "Public can view published events" ON public.events;
CREATE POLICY "Public can view published events"
ON public.events FOR SELECT
USING (
  (is_published = TRUE AND status <> 'draft')
  OR public.has_permission('can_event_view_module')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Authorized event admins can insert events" ON public.events;
CREATE POLICY "Authorized event admins can insert events"
ON public.events FOR INSERT
WITH CHECK (public.has_permission('can_event_create') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized event admins can update events" ON public.events;
CREATE POLICY "Authorized event admins can update events"
ON public.events FOR UPDATE
USING (
  public.has_permission('can_event_edit')
  OR public.has_permission('can_event_manage_settings')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Authorized event admins can delete draft or test events" ON public.events;
CREATE POLICY "Authorized event admins can delete draft or test events"
ON public.events FOR DELETE
USING (public.has_permission('can_event_delete_test_data') OR public.is_super_admin());

-- Event Fee Categories RLS
DROP POLICY IF EXISTS "Public can view active categories of published events" ON public.event_fee_categories;
CREATE POLICY "Public can view active categories of published events"
ON public.event_fee_categories FOR SELECT
USING (
  (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.is_published = TRUE AND e.status <> 'draft'
    )
  )
  OR public.has_permission('can_event_view_module')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Authorized admins can manage event categories" ON public.event_fee_categories;
CREATE POLICY "Authorized admins can manage event categories"
ON public.event_fee_categories FOR ALL
USING (public.has_permission('can_event_manage_categories') OR public.is_super_admin());

-- Event Applications RLS (Strictly Private!)
DROP POLICY IF EXISTS "Authorized admins can view event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can view event applications"
ON public.event_applications FOR SELECT
USING (public.has_permission('can_event_view_applications') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authorized admins can insert spot event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can insert spot event applications"
ON public.event_applications FOR INSERT
WITH CHECK (
  public.has_permission('can_event_approve_application')
  OR public.has_permission('can_event_verify_payment')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Authorized admins can update event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can update event applications"
ON public.event_applications FOR UPDATE
USING (
  public.has_permission('can_event_approve_application')
  OR public.has_permission('can_event_verify_payment')
  OR public.has_permission('can_event_manage_refund')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Authorized admins can delete test event applications" ON public.event_applications;
CREATE POLICY "Authorized admins can delete test event applications"
ON public.event_applications FOR DELETE
USING (public.has_permission('can_event_delete_test_data') OR public.is_super_admin());

-- Event Ledger Entries RLS (Dedicated Event Fund Only)
DROP POLICY IF EXISTS "Authorized admins can view event ledger" ON public.event_ledger_entries;
CREATE POLICY "Authorized admins can view event ledger"
ON public.event_ledger_entries FOR SELECT
USING (
  public.has_permission('can_event_view_finance_summary')
  OR public.has_permission('can_event_manage_ledger')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Authorized admins can manage event ledger" ON public.event_ledger_entries;
CREATE POLICY "Authorized admins can manage event ledger"
ON public.event_ledger_entries FOR ALL
USING (public.has_permission('can_event_manage_ledger') OR public.is_super_admin());

-- Event Application Logs RLS
DROP POLICY IF EXISTS "Authorized admins can view event logs" ON public.event_application_logs;
CREATE POLICY "Authorized admins can view event logs"
ON public.event_application_logs FOR SELECT
USING (public.has_permission('can_event_view_logs') OR public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated event admins can insert event logs" ON public.event_application_logs;
CREATE POLICY "Authenticated event admins can insert event logs"
ON public.event_application_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_permission('can_event_view_module')
    OR public.has_permission('can_event_approve_application')
    OR public.has_permission('can_event_verify_payment')
    OR public.has_permission('can_event_manage_refund')
    OR public.has_permission('can_event_manage_ledger')
    OR public.is_super_admin()
  )
);

-- 15. Explicit Grants
GRANT SELECT ON public.public_events_view, public.public_event_fee_categories_view TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events, public.event_fee_categories, public.event_applications, public.event_ledger_entries, public.event_application_logs TO authenticated;
