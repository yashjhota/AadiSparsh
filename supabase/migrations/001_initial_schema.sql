-- ============================================================================
-- Aadi Sparsh — Migration 001: Initial Schema
-- Multi-tenant schema for Jain Temple Reconnect & Parmatma Pooja platform
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically bump updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. ORGANIZATIONS (Top-level Trust / Foundation / Federation)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. CITIES (Regional operational groupings)
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'India',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_city_per_org UNIQUE (organization_id, name, state)
);

CREATE TRIGGER update_cities_updated_at
    BEFORE UPDATE ON cities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. TEMPLES (Individual participating holy pilgrimage / worship centers)
CREATE TABLE IF NOT EXISTS temples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
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
    closure_rules JSONB NOT NULL DEFAULT '{"closed_days_of_week": [0], "notice": "Sundays reserved for traditional trust sanctuary maintenance"}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_temple_slug_per_org UNIQUE (organization_id, slug)
);

CREATE TRIGGER update_temples_updated_at
    BEFORE UPDATE ON temples
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. PROFILES (Secure relationship with Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS profiles (
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

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. TEMPLE MEMBERSHIPS (Staff, Administrator & User Roles per Tenant)
CREATE TABLE IF NOT EXISTS temple_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    temple_id UUID REFERENCES temples(id) ON DELETE CASCADE, -- Nullable only for Org-level Superadmins
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'temple_admin', 'temple_manager', 'family')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint ensuring a user only has one role definition per temple scope (or org scope if temple_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_temple_membership
    ON temple_memberships (user_id, organization_id, (COALESCE(temple_id, '00000000-0000-0000-0000-000000000000'::uuid)));

CREATE TRIGGER update_temple_memberships_updated_at
    BEFORE UPDATE ON temple_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. AUDIT LOGS (Immutable security and operational event trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    temple_id UUID REFERENCES temples(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Critical Indexes for Performance & Scoped Lookups
CREATE INDEX IF NOT EXISTS idx_cities_org ON cities(organization_id);
CREATE INDEX IF NOT EXISTS idx_temples_org ON temples(organization_id);
CREATE INDEX IF NOT EXISTS idx_temples_city ON temples(city_id);
CREATE INDEX IF NOT EXISTS idx_temples_slug ON temples(slug);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON temple_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_temple ON temple_memberships(temple_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_temple ON audit_logs(temple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
