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
