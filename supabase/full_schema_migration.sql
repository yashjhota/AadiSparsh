-- ============================================================================
-- Aadi Sparsh — Complete Phase 1 Database Migration & Seed
-- Run this entire script in the Supabase Dashboard -> SQL Editor
-- Target Project: https://supabase.com/dashboard/project/ydqkczgqovuiytirwrxu
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: EXTENSIONS & HELPER TRIGGERS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- PART 2: FOUNDATIONAL TABLES
-- ----------------------------------------------------------------------------

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. CITIES
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'India',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_city_per_org UNIQUE (organization_id, name, state)
);

DROP TRIGGER IF EXISTS update_cities_updated_at ON public.cities;
CREATE TRIGGER update_cities_updated_at
    BEFORE UPDATE ON public.cities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. TEMPLES
CREATE TABLE IF NOT EXISTS public.temples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    address TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    pooja_start_time TIME NOT NULL DEFAULT '06:00:00',
    pooja_end_time TIME NOT NULL DEFAULT '08:00:00',
    daily_family_capacity INTEGER NOT NULL DEFAULT 15 CHECK (daily_family_capacity > 0),
    registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rolling_booking_months INTEGER NOT NULL DEFAULT 6 CHECK (rolling_booking_months > 0 AND rolling_booking_months <= 24),
    booking_cutoff_time TIME NOT NULL DEFAULT '18:00:00',
    closure_rules JSONB NOT NULL DEFAULT '{"closed_days_of_week": [0], "closure_reason": "Sunday trust sanctuary maintenance"}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_temple_slug_per_org UNIQUE (organization_id, slug)
);

DROP TRIGGER IF EXISTS update_temples_updated_at ON public.temples;
CREATE TRIGGER update_temples_updated_at
    BEFORE UPDATE ON public.temples
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    verified_mobile TEXT NOT NULL UNIQUE,
    locality TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'India',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. TEMPLE MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.temple_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    temple_id UUID REFERENCES public.temples(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'temple_admin', 'temple_manager', 'family')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_temple_membership
    ON public.temple_memberships (user_id, organization_id, (COALESCE(temple_id, '00000000-0000-0000-0000-000000000000'::uuid)));

DROP TRIGGER IF EXISTS update_temple_memberships_updated_at ON public.temple_memberships;
CREATE TRIGGER update_temple_memberships_updated_at
    BEFORE UPDATE ON public.temple_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    temple_id UUID REFERENCES public.temples(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_cities_org ON public.cities(organization_id);
CREATE INDEX IF NOT EXISTS idx_temples_org ON public.temples(organization_id);
CREATE INDEX IF NOT EXISTS idx_temples_city ON public.temples(city_id);
CREATE INDEX IF NOT EXISTS idx_temples_slug ON public.temples(slug);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.temple_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_temple ON public.temple_memberships(temple_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_temple ON public.audit_logs(temple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- PART 3: ROW LEVEL SECURITY & POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temple_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security Definer Helpers
CREATE OR REPLACE FUNCTION public.is_superadmin(org_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.temple_memberships
        WHERE user_id = auth.uid()
          AND role = 'superadmin'
          AND status = 'active'
          AND (org_id IS NULL OR organization_id = org_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.is_temple_admin(check_temple_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.temple_memberships m
        WHERE m.user_id = auth.uid()
          AND m.status = 'active'
          AND (
              m.role = 'superadmin'
              OR (m.role = 'temple_admin' AND m.temple_id = check_temple_id)
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_temple_staff(check_temple_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.temple_memberships m
        WHERE m.user_id = auth.uid()
          AND m.status = 'active'
          AND (
              m.role = 'superadmin'
              OR (m.role IN ('temple_admin', 'temple_manager') AND m.temple_id = check_temple_id)
          )
    );
$$;

-- Drop existing policies if re-running
DO $$
BEGIN
    DROP POLICY IF EXISTS "organizations_select_active" ON public.organizations;
    DROP POLICY IF EXISTS "organizations_insert_superadmin" ON public.organizations;
    DROP POLICY IF EXISTS "organizations_update_superadmin" ON public.organizations;
    DROP POLICY IF EXISTS "organizations_delete_superadmin" ON public.organizations;

    DROP POLICY IF EXISTS "cities_select_public" ON public.cities;
    DROP POLICY IF EXISTS "cities_insert_superadmin" ON public.cities;
    DROP POLICY IF EXISTS "cities_update_superadmin" ON public.cities;
    DROP POLICY IF EXISTS "cities_delete_superadmin" ON public.cities;

    DROP POLICY IF EXISTS "temples_select_public_active" ON public.temples;
    DROP POLICY IF EXISTS "temples_select_staff" ON public.temples;
    DROP POLICY IF EXISTS "temples_insert_superadmin" ON public.temples;
    DROP POLICY IF EXISTS "temples_update_admin" ON public.temples;
    DROP POLICY IF EXISTS "temples_delete_superadmin" ON public.temples;

    DROP POLICY IF EXISTS "profiles_select_owner" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_insert_owner" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_owner" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_delete_deny" ON public.profiles;

    DROP POLICY IF EXISTS "memberships_select_own" ON public.temple_memberships;
    DROP POLICY IF EXISTS "memberships_select_admin" ON public.temple_memberships;
    DROP POLICY IF EXISTS "memberships_insert_admin" ON public.temple_memberships;
    DROP POLICY IF EXISTS "memberships_update_admin" ON public.temple_memberships;
    DROP POLICY IF EXISTS "memberships_delete_admin" ON public.temple_memberships;

    DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert_privileged" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_deny_update" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_deny_delete" ON public.audit_logs;
END $$;

-- Organizations Policies
CREATE POLICY "organizations_select_active" ON public.organizations FOR SELECT USING (status = 'active' OR public.is_superadmin(id));
CREATE POLICY "organizations_insert_superadmin" ON public.organizations FOR INSERT WITH CHECK (public.is_superadmin());
CREATE POLICY "organizations_update_superadmin" ON public.organizations FOR UPDATE USING (public.is_superadmin(id)) WITH CHECK (public.is_superadmin(id));
CREATE POLICY "organizations_delete_superadmin" ON public.organizations FOR DELETE USING (public.is_superadmin(id));

-- Cities Policies
CREATE POLICY "cities_select_public" ON public.cities FOR SELECT USING (TRUE);
CREATE POLICY "cities_insert_superadmin" ON public.cities FOR INSERT WITH CHECK (public.is_superadmin(organization_id));
CREATE POLICY "cities_update_superadmin" ON public.cities FOR UPDATE USING (public.is_superadmin(organization_id)) WITH CHECK (public.is_superadmin(organization_id));
CREATE POLICY "cities_delete_superadmin" ON public.cities FOR DELETE USING (public.is_superadmin(organization_id));

-- Temples Policies
CREATE POLICY "temples_select_public_active" ON public.temples FOR SELECT USING (status = 'active' AND registration_enabled = TRUE);
CREATE POLICY "temples_select_staff" ON public.temples FOR SELECT TO authenticated USING (public.is_temple_staff(id));
CREATE POLICY "temples_insert_superadmin" ON public.temples FOR INSERT TO authenticated WITH CHECK (public.is_superadmin(organization_id));
CREATE POLICY "temples_update_admin" ON public.temples FOR UPDATE TO authenticated USING (public.is_temple_admin(id)) WITH CHECK (public.is_temple_admin(id));
CREATE POLICY "temples_delete_superadmin" ON public.temples FOR DELETE TO authenticated USING (public.is_superadmin(organization_id));

-- Profiles Policies
CREATE POLICY "profiles_select_owner" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_staff" ON public.profiles FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.temple_memberships m
        WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role IN ('superadmin', 'temple_admin', 'temple_manager')
    )
);
CREATE POLICY "profiles_insert_owner" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_owner" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_delete_deny" ON public.profiles FOR DELETE TO authenticated USING (FALSE);

-- Temple Memberships Policies
CREATE POLICY "memberships_select_own" ON public.temple_memberships FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "memberships_select_admin" ON public.temple_memberships FOR SELECT TO authenticated USING (
    public.is_superadmin(organization_id) OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
);
CREATE POLICY "memberships_insert_admin" ON public.temple_memberships FOR INSERT TO authenticated WITH CHECK (
    public.is_superadmin(organization_id) OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id) AND role IN ('temple_manager', 'family'))
);
CREATE POLICY "memberships_update_admin" ON public.temple_memberships FOR UPDATE TO authenticated USING (
    public.is_superadmin(organization_id) OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
) WITH CHECK (
    public.is_superadmin(organization_id) OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
);
CREATE POLICY "memberships_delete_admin" ON public.temple_memberships FOR DELETE TO authenticated USING (
    public.is_superadmin(organization_id) OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
);

-- Audit Logs Policies (Tamper-Proof)
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT TO authenticated USING (
    public.is_superadmin(organization_id) OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
);
CREATE POLICY "audit_logs_insert_privileged" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (
    actor_user_id = auth.uid() AND (public.is_superadmin(organization_id) OR (temple_id IS NOT NULL AND public.is_temple_staff(temple_id)))
);
CREATE POLICY "audit_logs_deny_update" ON public.audit_logs FOR UPDATE TO authenticated USING (FALSE);
CREATE POLICY "audit_logs_deny_delete" ON public.audit_logs FOR DELETE TO authenticated USING (FALSE);

-- ----------------------------------------------------------------------------
-- PART 4: SEED DATA (CHICKPET BENGALURU & CHENNAI)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    org_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    bengaluru_city_id UUID := '22222222-2222-2222-2222-222222222221'::uuid;
    chennai_city_id UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    chickpet_temple_id UUID := '33333333-3333-3333-3333-333333333331'::uuid;
    chennai_temple_id UUID := '33333333-3333-3333-3333-333333333332'::uuid;
BEGIN
    -- 1. Organization
    INSERT INTO public.organizations (id, name, slug, status)
    VALUES (org_id, 'Shree Jain Shwetambar Murtipujak Trust Federation', 'jain-trust-federation', 'active')
    ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

    -- 2. Cities
    INSERT INTO public.cities (id, organization_id, name, state, country, timezone)
    VALUES (bengaluru_city_id, org_id, 'Bengaluru', 'Karnataka', 'India', 'Asia/Kolkata')
    ON CONFLICT (organization_id, name, state) DO UPDATE SET updated_at = NOW();

    INSERT INTO public.cities (id, organization_id, name, state, country, timezone)
    VALUES (chennai_city_id, org_id, 'Chennai', 'Tamil Nadu', 'India', 'Asia/Kolkata')
    ON CONFLICT (organization_id, name, state) DO UPDATE SET updated_at = NOW();

    -- 3. Chickpet Temple
    INSERT INTO public.temples (
        id, organization_id, city_id, name, slug, address, timezone,
        pooja_start_time, pooja_end_time, daily_family_capacity,
        registration_enabled, rolling_booking_months, booking_cutoff_time,
        closure_rules, status
    )
    VALUES (
        chickpet_temple_id, org_id, bengaluru_city_id,
        'Shri Adinath Bhagwan Jain Shwetambar Temple',
        'adinath-chickpet-bengaluru',
        'Chickpet Main Road, Near Old Tharagupet, Bengaluru, Karnataka 560053',
        'Asia/Kolkata', '06:00:00', '08:00:00', 15,
        TRUE, 6, '18:00:00',
        '{"closed_days_of_week": [0], "closure_reason": "Sunday sanctuary maintenance & Snatra rituals"}'::jsonb,
        'active'
    )
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        daily_family_capacity = EXCLUDED.daily_family_capacity,
        pooja_start_time = EXCLUDED.pooja_start_time,
        pooja_end_time = EXCLUDED.pooja_end_time,
        updated_at = NOW();

    -- 4. Chennai Temple
    INSERT INTO public.temples (
        id, organization_id, city_id, name, slug, address, timezone,
        pooja_start_time, pooja_end_time, daily_family_capacity,
        registration_enabled, rolling_booking_months, booking_cutoff_time,
        closure_rules, status
    )
    VALUES (
        chennai_temple_id, org_id, chennai_city_id,
        'Shri Shankheshwar Parshwanath Jain Temple',
        'shankheshwar-sowcarpet-chennai',
        'Mint Street, Sowcarpet, Chennai, Tamil Nadu 600079',
        'Asia/Kolkata', '06:30:00', '08:30:00', 20,
        TRUE, 6, '18:00:00',
        '{"closed_days_of_week": [], "closure_reason": "Open all 7 days with prior family pooja registration"}'::jsonb,
        'active'
    )
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        daily_family_capacity = EXCLUDED.daily_family_capacity,
        updated_at = NOW();

    -- 5. System Initialization Audit Log
    INSERT INTO public.audit_logs (
        id, actor_user_id, organization_id, temple_id,
        entity_type, entity_id, action, before_data, after_data
    )
    VALUES (
        gen_random_uuid(), NULL, org_id, chickpet_temple_id,
        'system', chickpet_temple_id::text, 'PHASE_1_SCHEMA_INITIALIZED',
        NULL,
        jsonb_build_object('event', 'Aadi Sparsh Phase 1 schema & Chickpet temple initialized', 'version', '1.0.0')
    );
END $$;

-- ----------------------------------------------------------------------------
-- PART 6: PHASE 2A FAMILY PROFILES & MOBILE AUTH SAFEGUARDS
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_verified_mobile ON public.profiles (verified_mobile);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

CREATE OR REPLACE FUNCTION public.protect_verified_mobile()
RETURNS TRIGGER AS $$
DECLARE
    current_jwt_role TEXT;
BEGIN
    -- Retrieve JWT role if present in request context
    current_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');

    -- Allow trusted server-side processes (service_role or database superuser) for legitimate maintenance
    IF current_jwt_role = 'service_role' OR current_user = 'postgres' THEN
        NEW.updated_at = NOW();
        RETURN NEW;
    END IF;

    -- Prevent ordinary client / authenticated user from changing verified_mobile
    IF OLD.verified_mobile IS NOT NULL AND OLD.verified_mobile <> '' AND OLD.verified_mobile IS DISTINCT FROM NEW.verified_mobile THEN
        RAISE EXCEPTION 'Verified mobile number is immutable and cannot be changed. It is permanently anchored to the authenticated session.';
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_verified_mobile ON public.profiles;
CREATE TRIGGER trigger_protect_verified_mobile
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_verified_mobile();

-- ----------------------------------------------------------------------------
-- PART 7: PHASE 2B REGISTRATIONS & BOOKING ENGINE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number TEXT NOT NULL UNIQUE,
    temple_id UUID NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    member_count INTEGER NOT NULL CHECK (member_count >= 1),
    occasion TEXT NOT NULL CHECK (occasion IN ('birthday', 'wedding_anniversary', 'family_pooja', 'special_day', 'other')),
    occasion_date DATE,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'cancelled', 'rescheduled')),
    original_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    rescheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_registrations_updated_at
    BEFORE UPDATE ON public.registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_user_temple_date 
    ON public.registrations (user_id, temple_id, visit_date) 
    WHERE status = 'upcoming';

CREATE INDEX IF NOT EXISTS idx_registrations_temple_date ON public.registrations(temple_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON public.registrations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_number ON public.registrations(registration_number);

CREATE TABLE IF NOT EXISTS public.registration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'rescheduled', 'cancelled')),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_events_registration ON public.registration_events(registration_id, created_at ASC);

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registrations_select_owner" ON public.registrations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "registrations_select_staff" ON public.registrations FOR SELECT TO authenticated USING (
    public.is_temple_staff(temple_id)
    OR EXISTS (SELECT 1 FROM public.temple_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'superadmin')
);
CREATE POLICY "registrations_admin_write" ON public.registrations FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.temple_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'superadmin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.temple_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'superadmin')
);

CREATE POLICY "reg_events_select_owner" ON public.registration_events FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = registration_events.registration_id AND r.user_id = auth.uid())
);
CREATE POLICY "reg_events_select_staff" ON public.registration_events FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = registration_events.registration_id AND (
        public.is_temple_staff(r.temple_id)
        OR EXISTS (SELECT 1 FROM public.temple_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'superadmin')
    ))
);

CREATE OR REPLACE FUNCTION public.get_temple_calendar_availability(p_temple_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    calendar_date DATE,
    active_family_bookings INT,
    capacity INT,
    slots_remaining INT,
    is_available BOOLEAN,
    is_closed BOOLEAN,
    closure_reason TEXT,
    is_past BOOLEAN,
    is_cutoff_passed BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
    v_temple RECORD;
    v_tz TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_curr_date DATE;
    v_curr_time TIME;
    v_iter_date DATE;
    v_dow INT;
    v_count INT;
    v_is_closed BOOLEAN;
    v_reason TEXT;
    v_past BOOLEAN;
    v_cutoff BOOLEAN;
BEGIN
    SELECT * INTO v_temple FROM public.temples WHERE id = p_temple_id;
    IF NOT FOUND THEN RETURN; END IF;
    v_tz := COALESCE(v_temple.timezone, 'Asia/Kolkata');
    v_curr_date := (v_now AT TIME ZONE v_tz)::date;
    v_curr_time := (v_now AT TIME ZONE v_tz)::time;
    v_iter_date := p_start_date;
    WHILE v_iter_date <= p_end_date LOOP
        v_dow := EXTRACT(DOW FROM v_iter_date)::int;
        v_past := (v_iter_date <= v_curr_date);
        v_cutoff := (v_iter_date = v_curr_date + 1 AND v_curr_time >= v_temple.booking_cutoff_time);
        v_is_closed := FALSE;
        v_reason := NULL;
        IF (v_temple.closure_rules->'closed_days_of_week') @> to_jsonb(v_dow) THEN
            v_is_closed := TRUE;
            v_reason := COALESCE(v_temple.closure_rules->>'notice', 'Sanctuary maintenance');
        ELSIF v_temple.status <> 'active' OR NOT v_temple.registration_enabled THEN
            v_is_closed := TRUE;
            v_reason := 'Bookings temporarily suspended';
        END IF;
        SELECT COUNT(*)::int INTO v_count FROM public.registrations WHERE temple_id = p_temple_id AND visit_date = v_iter_date AND status = 'upcoming';
        calendar_date := v_iter_date;
        active_family_bookings := v_count;
        capacity := v_temple.daily_family_capacity;
        slots_remaining := GREATEST(0, v_temple.daily_family_capacity - v_count);
        is_past := v_past;
        is_cutoff_passed := v_cutoff;
        is_closed := v_is_closed;
        closure_reason := v_reason;
        is_available := (NOT v_past) AND (NOT v_cutoff) AND (NOT v_is_closed) AND (slots_remaining > 0);
        RETURN NEXT;
        v_iter_date := v_iter_date + 1;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_temple_visit(
    p_temple_id UUID,
    p_visit_date DATE,
    p_member_count INT,
    p_occasion TEXT,
    p_occasion_date DATE DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id UUID;
    v_temple RECORD;
    v_tz TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_current_local_date DATE;
    v_current_local_time TIME;
    v_dow INT;
    v_max_date DATE;
    v_active_count INT;
    v_reg_number TEXT;
    v_new_reg RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required to book temple visit.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN RAISE EXCEPTION 'Devotee profile not found.'; END IF;
    IF p_member_count IS NULL OR p_member_count < 1 THEN RAISE EXCEPTION 'Member count must be at least 1 devotee.'; END IF;
    IF p_occasion NOT IN ('birthday', 'wedding_anniversary', 'family_pooja', 'special_day', 'other') THEN RAISE EXCEPTION 'Invalid occasion specified.'; END IF;
    SELECT * INTO v_temple FROM public.temples WHERE id = p_temple_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selected temple does not exist.'; END IF;
    IF v_temple.status <> 'active' OR NOT v_temple.registration_enabled THEN RAISE EXCEPTION 'This temple is not currently accepting visit bookings.'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(p_temple_id::text || ':' || p_visit_date::text));
    v_tz := COALESCE(v_temple.timezone, 'Asia/Kolkata');
    v_current_local_date := (v_now AT TIME ZONE v_tz)::date;
    v_current_local_time := (v_now AT TIME ZONE v_tz)::time;
    IF p_visit_date <= v_current_local_date THEN RAISE EXCEPTION 'Past or same-day dates are unavailable.'; END IF;
    v_max_date := (v_current_local_date + (v_temple.rolling_booking_months || ' months')::interval)::date;
    IF p_visit_date > v_max_date THEN RAISE EXCEPTION 'Date is beyond the % month booking calendar window.', v_temple.rolling_booking_months; END IF;
    IF p_visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time THEN RAISE EXCEPTION 'Booking deadline passed for tomorrow.'; END IF;
    v_dow := EXTRACT(DOW FROM p_visit_date)::int;
    IF (v_temple.closure_rules->'closed_days_of_week') @> to_jsonb(v_dow) THEN RAISE EXCEPTION 'Temple is closed on this day.'; END IF;
    IF EXISTS (SELECT 1 FROM public.registrations WHERE user_id = v_user_id AND temple_id = p_temple_id AND visit_date = p_visit_date AND status = 'upcoming') THEN
        RAISE EXCEPTION 'Your family already has an active reservation for this temple on %.', p_visit_date;
    END IF;
    SELECT COUNT(*) INTO v_active_count FROM public.registrations WHERE temple_id = p_temple_id AND visit_date = p_visit_date AND status = 'upcoming';
    IF v_active_count >= v_temple.daily_family_capacity THEN RAISE EXCEPTION 'Capacity reached: The maximum of % family reservations has already been filled.', v_temple.daily_family_capacity; END IF;
    v_reg_number := 'AS-' || UPPER(SUBSTRING(v_temple.slug FROM 1 FOR 3)) || '-' || TO_CHAR(p_visit_date, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 5));
    INSERT INTO public.registrations (registration_number, temple_id, user_id, visit_date, member_count, occasion, occasion_date, remarks, status, created_at, updated_at)
    VALUES (v_reg_number, p_temple_id, v_user_id, p_visit_date, p_member_count, p_occasion, p_occasion_date, NULLIF(TRIM(p_remarks), ''), 'upcoming', v_now, v_now)
    RETURNING * INTO v_new_reg;
    INSERT INTO public.registration_events (registration_id, event_type, actor_user_id, details, created_at)
    VALUES (v_new_reg.id, 'created', v_user_id, jsonb_build_object('registration_number', v_reg_number, 'visit_date', p_visit_date, 'member_count', p_member_count, 'occasion', p_occasion), v_now);
    RETURN to_jsonb(v_new_reg);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_family_booking(p_registration_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id UUID;
    v_reg RECORD;
    v_temple RECORD;
    v_tz TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_current_local_date DATE;
    v_current_local_time TIME;
    v_updated_reg RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found.'; END IF;
    IF v_reg.user_id <> v_user_id THEN RAISE EXCEPTION 'Unauthorized.'; END IF;
    IF v_reg.status <> 'upcoming' THEN RAISE EXCEPTION 'Only upcoming registrations can be cancelled.'; END IF;
    SELECT * INTO v_temple FROM public.temples WHERE id = v_reg.temple_id;
    v_tz := COALESCE(v_temple.timezone, 'Asia/Kolkata');
    v_current_local_date := (v_now AT TIME ZONE v_tz)::date;
    v_current_local_time := (v_now AT TIME ZONE v_tz)::time;
    IF v_reg.visit_date <= v_current_local_date OR (v_reg.visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time) THEN
        RAISE EXCEPTION 'Cancellation deadline passed.';
    END IF;
    UPDATE public.registrations SET status = 'cancelled', cancellation_reason = NULLIF(TRIM(p_reason), ''), cancelled_at = v_now, updated_at = v_now WHERE id = p_registration_id RETURNING * INTO v_updated_reg;
    INSERT INTO public.registration_events (registration_id, event_type, actor_user_id, details, created_at) VALUES (p_registration_id, 'cancelled', v_user_id, jsonb_build_object('reason', p_reason, 'visit_date', v_reg.visit_date), v_now);
    RETURN to_jsonb(v_updated_reg);
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_family_booking(p_registration_id UUID, p_new_visit_date DATE, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id UUID;
    v_old_reg RECORD;
    v_temple RECORD;
    v_tz TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_current_local_date DATE;
    v_current_local_time TIME;
    v_dow INT;
    v_max_date DATE;
    v_new_active_count INT;
    v_new_reg_number TEXT;
    v_new_reg RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    SELECT * INTO v_old_reg FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Original registration not found.'; END IF;
    IF v_old_reg.user_id <> v_user_id THEN RAISE EXCEPTION 'Unauthorized.'; END IF;
    IF v_old_reg.status <> 'upcoming' THEN RAISE EXCEPTION 'Only upcoming active registrations can be rescheduled.'; END IF;
    IF p_new_visit_date = v_old_reg.visit_date THEN RAISE EXCEPTION 'New visit date must be different.'; END IF;
    SELECT * INTO v_temple FROM public.temples WHERE id = v_old_reg.temple_id;
    v_tz := COALESCE(v_temple.timezone, 'Asia/Kolkata');
    v_current_local_date := (v_now AT TIME ZONE v_tz)::date;
    v_current_local_time := (v_now AT TIME ZONE v_tz)::time;
    IF v_old_reg.visit_date <= v_current_local_date OR (v_old_reg.visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time) THEN
        RAISE EXCEPTION 'Rescheduling deadline passed for the current visit.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(v_old_reg.temple_id::text || ':' || p_new_visit_date::text));
    IF p_new_visit_date <= v_current_local_date THEN RAISE EXCEPTION 'Target date must be a future date.'; END IF;
    v_max_date := (v_current_local_date + (v_temple.rolling_booking_months || ' months')::interval)::date;
    IF p_new_visit_date > v_max_date THEN RAISE EXCEPTION 'Target date is beyond allowed booking window.'; END IF;
    IF p_new_visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time THEN RAISE EXCEPTION 'Booking deadline passed for tomorrow.'; END IF;
    v_dow := EXTRACT(DOW FROM p_new_visit_date)::int;
    IF (v_temple.closure_rules->'closed_days_of_week') @> to_jsonb(v_dow) THEN RAISE EXCEPTION 'Temple is closed on requested date.'; END IF;
    IF EXISTS (SELECT 1 FROM public.registrations WHERE user_id = v_user_id AND temple_id = v_old_reg.temple_id AND visit_date = p_new_visit_date AND status = 'upcoming') THEN
        RAISE EXCEPTION 'Active reservation already exists on %.', p_new_visit_date;
    END IF;
    SELECT COUNT(*) INTO v_new_active_count FROM public.registrations WHERE temple_id = v_old_reg.temple_id AND visit_date = p_new_visit_date AND status = 'upcoming';
    IF v_new_active_count >= v_temple.daily_family_capacity THEN RAISE EXCEPTION 'Target date % has reached capacity.', p_new_visit_date; END IF;
    UPDATE public.registrations SET status = 'rescheduled', rescheduled_at = v_now, updated_at = v_now WHERE id = p_registration_id;
    v_new_reg_number := 'AS-' || UPPER(SUBSTRING(v_temple.slug FROM 1 FOR 3)) || '-' || TO_CHAR(p_new_visit_date, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 5));
    INSERT INTO public.registrations (registration_number, temple_id, user_id, visit_date, member_count, occasion, occasion_date, remarks, status, original_registration_id, created_at, updated_at)
    VALUES (v_new_reg_number, v_old_reg.temple_id, v_user_id, p_new_visit_date, v_old_reg.member_count, v_old_reg.occasion, v_old_reg.occasion_date, COALESCE(NULLIF(TRIM(p_reason), ''), v_old_reg.remarks), 'upcoming', v_old_reg.id, v_now, v_now)
    RETURNING * INTO v_new_reg;
    INSERT INTO public.registration_events (registration_id, event_type, actor_user_id, details, created_at) VALUES (v_old_reg.id, 'rescheduled', v_user_id, jsonb_build_object('rescheduled_to_date', p_new_visit_date, 'replacement_id', v_new_reg.id, 'reason', p_reason), v_now);
    INSERT INTO public.registration_events (registration_id, event_type, actor_user_id, details, created_at) VALUES (v_new_reg.id, 'created', v_user_id, jsonb_build_object('rescheduled_from_id', v_old_reg.id, 'rescheduled_from_date', v_old_reg.visit_date), v_now);
    RETURN to_jsonb(v_new_reg);
END;
$$;

