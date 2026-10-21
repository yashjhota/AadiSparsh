-- ============================================================================
-- Aadi Sparsh — Migration 004: Family Profiles & Mobile Auth Safeguards
-- Phase 2A: Authentication and Family Profiles
-- ============================================================================

-- 1. Indexing on profiles table for rapid lookup by verified mobile number
CREATE INDEX IF NOT EXISTS idx_profiles_verified_mobile ON public.profiles (verified_mobile);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- 2. Trigger to ensure verified_mobile cannot be modified once set via authentication
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

-- 3. Security verification: Verify that temple_memberships strictly prohibits self-insertion
-- (Ensured by Migration 002 memberships_insert_admin policy)
-- Family accounts are identified by existence of a profile with NO active staff temple_membership.

COMMENT ON TABLE public.profiles IS 'Devotee and staff user profiles. Mobile number is derived from authenticated session.';
COMMENT ON COLUMN public.profiles.verified_mobile IS 'E.164 phone number verified via Supabase Auth OTP.';
