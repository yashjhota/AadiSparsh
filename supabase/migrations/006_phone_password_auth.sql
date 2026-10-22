-- ============================================================================
-- Aadi Sparsh — Migration 006: Phone and Password Authentication Configuration
-- Transition to Unified Mobile Number & Password Authentication
-- ============================================================================

-- In Supabase GoTrue Auth, Phone authentication supports both SMS OTP and 
-- password-based sign-in via `supabase.auth.signInWithPassword({ phone, password })`
-- and `supabase.auth.signUp({ phone, password })`.

-- 1. Ensure Profile Auto-Creation Trigger on auth.users for Phone & Password
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_raw_phone TEXT;
    v_full_name TEXT;
BEGIN
    -- Extract phone from auth.users (GoTrue stores it in new.phone)
    v_raw_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
    
    -- Extract full name if passed in user_metadata during signUp
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        'Devotee Family'
    );

    -- Insert or update public.profiles with verified_mobile from auth
    INSERT INTO public.profiles (
        id,
        full_name,
        verified_mobile,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_full_name,
        NULLIF(TRIM(v_raw_phone), ''),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = CASE 
            WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = 'Devotee Family' 
            THEN EXCLUDED.full_name 
            ELSE public.profiles.full_name 
        END,
        verified_mobile = COALESCE(public.profiles.verified_mobile, EXCLUDED.verified_mobile),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if attached to auth.users, and re-attach
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Helper RPC: Resolve User Role from Verified Temple Memberships
-- Allows client to securely discover whether authenticated mobile has staff privileges
CREATE OR REPLACE FUNCTION public.get_authenticated_user_role()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_membership RECORD;
    v_profile RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('authenticated', false, 'role', 'anon');
    END IF;

    -- Fetch profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    -- Look for highest active staff membership
    -- Order by precedence: superadmin > temple_admin > temple_manager
    SELECT m.*, t.name as temple_name, t.slug as temple_slug
    INTO v_membership
    FROM public.temple_memberships m
    JOIN public.temples t ON t.id = m.temple_id
    WHERE m.user_id = v_user_id AND m.status = 'active'
    ORDER BY CASE m.role
        WHEN 'superadmin' THEN 1
        WHEN 'temple_admin' THEN 2
        WHEN 'temple_manager' THEN 3
        ELSE 4
    END
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'authenticated', true,
            'user_id', v_user_id,
            'role', v_membership.role,
            'temple_id', v_membership.temple_id,
            'temple_name', v_membership.temple_name,
            'temple_slug', v_membership.temple_slug,
            'profile', to_jsonb(v_profile)
        );
    ELSE
        RETURN jsonb_build_object(
            'authenticated', true,
            'user_id', v_user_id,
            'role', 'family',
            'temple_id', null,
            'profile', to_jsonb(v_profile)
        );
    END IF;
END;
$$;
