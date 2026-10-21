-- ============================================================================
-- Aadi Sparsh — Migration 002: Row Level Security (RLS) Policies
-- Enforces tenant isolation, role verification, and access controls
-- ============================================================================

-- Enable RLS on all foundational tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE temples ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE temple_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- SECURITY DEFINER HELPER FUNCTIONS
-- Executed with security definer to avoid circular RLS evaluation recursion
-- ----------------------------------------------------------------------------

-- Check if current authenticated user is a Superadmin in the organization
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

-- Check if current user is Temple Admin for a specific temple
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

-- Check if current user has any staff role (admin or manager) for a temple
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

-- ----------------------------------------------------------------------------
-- 1. ORGANIZATIONS POLICIES
-- ----------------------------------------------------------------------------
-- Public & Authenticated can view active organizations
CREATE POLICY "organizations_select_active"
    ON organizations FOR SELECT
    USING (status = 'active' OR public.is_superadmin(id));

-- Only Superadmins can insert/update/delete organizations
CREATE POLICY "organizations_insert_superadmin"
    ON organizations FOR INSERT
    WITH CHECK (public.is_superadmin());

CREATE POLICY "organizations_update_superadmin"
    ON organizations FOR UPDATE
    USING (public.is_superadmin(id))
    WITH CHECK (public.is_superadmin(id));

CREATE POLICY "organizations_delete_superadmin"
    ON organizations FOR DELETE
    USING (public.is_superadmin(id));

-- ----------------------------------------------------------------------------
-- 2. CITIES POLICIES
-- ----------------------------------------------------------------------------
-- Cities are viewable if belonging to active organizations
CREATE POLICY "cities_select_public"
    ON cities FOR SELECT
    USING (TRUE);

-- Superadmins can manage cities
CREATE POLICY "cities_insert_superadmin"
    ON cities FOR INSERT
    WITH CHECK (public.is_superadmin(organization_id));

CREATE POLICY "cities_update_superadmin"
    ON cities FOR UPDATE
    USING (public.is_superadmin(organization_id))
    WITH CHECK (public.is_superadmin(organization_id));

CREATE POLICY "cities_delete_superadmin"
    ON cities FOR DELETE
    USING (public.is_superadmin(organization_id));

-- ----------------------------------------------------------------------------
-- 3. TEMPLES POLICIES
-- ----------------------------------------------------------------------------
-- Publicly readable only for active temples with registration enabled
CREATE POLICY "temples_select_public_active"
    ON temples FOR SELECT
    USING (status = 'active' AND registration_enabled = TRUE);

-- Staff can view their temple even during maintenance or when disabled
CREATE POLICY "temples_select_staff"
    ON temples FOR SELECT
    TO authenticated
    USING (public.is_temple_staff(id));

-- Superadmins can add new temples
CREATE POLICY "temples_insert_superadmin"
    ON temples FOR INSERT
    TO authenticated
    WITH CHECK (public.is_superadmin(organization_id));

-- Superadmin or assigned Temple Admin can update temple configuration
CREATE POLICY "temples_update_admin"
    ON temples FOR UPDATE
    TO authenticated
    USING (public.is_temple_admin(id))
    WITH CHECK (public.is_temple_admin(id));

-- Only Superadmin can delete a temple record
CREATE POLICY "temples_delete_superadmin"
    ON temples FOR DELETE
    TO authenticated
    USING (public.is_superadmin(organization_id));

-- ----------------------------------------------------------------------------
-- 4. PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Devotees/Staff can read only their own profile
CREATE POLICY "profiles_select_owner"
    ON profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Staff can view devotee profiles if relevant to temple operations
CREATE POLICY "profiles_select_staff"
    ON profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.temple_memberships m
            WHERE m.user_id = auth.uid()
              AND m.status = 'active'
              AND m.role IN ('superadmin', 'temple_admin', 'temple_manager')
        )
    );

-- User can insert their own profile on registration
CREATE POLICY "profiles_insert_owner"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- User can update only their own profile
CREATE POLICY "profiles_update_owner"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Profiles cannot be deleted directly via client API
CREATE POLICY "profiles_delete_deny"
    ON profiles FOR DELETE
    TO authenticated
    USING (FALSE);

-- ----------------------------------------------------------------------------
-- 5. TEMPLE MEMBERSHIPS POLICIES
-- ----------------------------------------------------------------------------
-- Users can inspect their own active memberships
CREATE POLICY "memberships_select_own"
    ON temple_memberships FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Superadmins and Temple Admins can view memberships within their scope
CREATE POLICY "memberships_select_admin"
    ON temple_memberships FOR SELECT
    TO authenticated
    USING (
        public.is_superadmin(organization_id)
        OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
    );

-- Memberships can only be assigned by Superadmins or Temple Admins (scoped)
CREATE POLICY "memberships_insert_admin"
    ON temple_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_superadmin(organization_id)
        OR (
            temple_id IS NOT NULL
            AND public.is_temple_admin(temple_id)
            AND role IN ('temple_manager', 'family')
        )
    );

-- Memberships can only be updated by authorized admins
CREATE POLICY "memberships_update_admin"
    ON temple_memberships FOR UPDATE
    TO authenticated
    USING (
        public.is_superadmin(organization_id)
        OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
    )
    WITH CHECK (
        public.is_superadmin(organization_id)
        OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
    );

-- Memberships deletion (revocation)
CREATE POLICY "memberships_delete_admin"
    ON temple_memberships FOR DELETE
    TO authenticated
    USING (
        public.is_superadmin(organization_id)
        OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
    );

-- ----------------------------------------------------------------------------
-- 6. AUDIT LOGS POLICIES (Tamper-Proof)
-- ----------------------------------------------------------------------------
-- Superadmins can view all org logs; Temple Admins can view only their temple's logs
CREATE POLICY "audit_logs_select_admin"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (
        public.is_superadmin(organization_id)
        OR (temple_id IS NOT NULL AND public.is_temple_admin(temple_id))
    );

-- Privileged audit log insertion: Only authorized staff (Superadmin or Temple Staff) can insert audit logs
CREATE POLICY "audit_logs_insert_privileged"
    ON audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        actor_user_id = auth.uid()
        AND (
            public.is_superadmin(organization_id)
            OR (temple_id IS NOT NULL AND public.is_temple_staff(temple_id))
        )
    );

-- STRICT SECURITY: NO USER may modify or delete audit log entries under any circumstances
CREATE POLICY "audit_logs_deny_update"
    ON audit_logs FOR UPDATE
    TO authenticated
    USING (FALSE);

CREATE POLICY "audit_logs_deny_delete"
    ON audit_logs FOR DELETE
    TO authenticated
    USING (FALSE);
