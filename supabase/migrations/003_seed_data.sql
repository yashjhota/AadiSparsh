-- ============================================================================
-- Aadi Sparsh — Migration 003: Development Seed Data
-- Run this script in development environments or during initial project onboarding.
-- DO NOT automatically run this in production without explicit administrative intent.
-- ============================================================================

DO $$
DECLARE
    org_id UUID;
    bengaluru_city_id UUID;
    chennai_city_id UUID;
    chickpet_temple_id UUID;
    chennai_temple_id UUID;
BEGIN
    -- 1. Create Default Multi-Temple Federation Organization
    INSERT INTO organizations (id, name, slug, status)
    VALUES (
        '11111111-1111-1111-1111-111111111111'::uuid,
        'Shree Jain Shwetambar Murtipujak Trust Federation',
        'jain-trust-federation',
        'active'
    )
    ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO org_id;

    IF org_id IS NULL THEN
        SELECT id INTO org_id FROM organizations WHERE slug = 'jain-trust-federation';
    END IF;

    -- 2. Seed Cities: Bengaluru & Chennai
    INSERT INTO cities (id, organization_id, name, state, country, timezone)
    VALUES (
        '22222222-2222-2222-2222-222222222221'::uuid,
        org_id,
        'Bengaluru',
        'Karnataka',
        'India',
        'Asia/Kolkata'
    )
    ON CONFLICT (organization_id, name, state) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO bengaluru_city_id;

    IF bengaluru_city_id IS NULL THEN
        SELECT id INTO bengaluru_city_id FROM cities WHERE organization_id = org_id AND name = 'Bengaluru';
    END IF;

    INSERT INTO cities (id, organization_id, name, state, country, timezone)
    VALUES (
        '22222222-2222-2222-2222-222222222222'::uuid,
        org_id,
        'Chennai',
        'Tamil Nadu',
        'India',
        'Asia/Kolkata'
    )
    ON CONFLICT (organization_id, name, state) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO chennai_city_id;

    IF chennai_city_id IS NULL THEN
        SELECT id INTO chennai_city_id FROM cities WHERE organization_id = org_id AND name = 'Chennai';
    END IF;

    -- 3. Seed Initial Temples:
    -- Temple 1: Shri Adinath Bhagwan Jain Temple, Chickpet, Bengaluru
    INSERT INTO temples (
        id,
        organization_id,
        city_id,
        name,
        slug,
        address,
        timezone,
        pooja_start_time,
        pooja_end_time,
        daily_family_capacity,
        registration_enabled,
        rolling_booking_months,
        booking_cutoff_time,
        closure_rules,
        status
    )
    VALUES (
        '33333333-3333-3333-3333-333333333331'::uuid,
        org_id,
        bengaluru_city_id,
        'Shri Adinath Bhagwan Jain Shwetambar Temple',
        'adinath-chickpet-bengaluru',
        'Chickpet Main Road, Near Old Tharagupet, Bengaluru, Karnataka 560053',
        'Asia/Kolkata',
        '06:00:00',
        '08:00:00',
        15,
        TRUE,
        6,
        '18:00:00',
        '{"closed_days_of_week": [0], "closure_reason": "Sunday trust sanctuary maintenance and Snatra rituals"}'::jsonb,
        'active'
    )
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        daily_family_capacity = EXCLUDED.daily_family_capacity,
        pooja_start_time = EXCLUDED.pooja_start_time,
        pooja_end_time = EXCLUDED.pooja_end_time,
        booking_cutoff_time = EXCLUDED.booking_cutoff_time,
        closure_rules = EXCLUDED.closure_rules,
        updated_at = NOW()
    RETURNING id INTO chickpet_temple_id;

    -- Temple 2: Shri Shankheshwar Parshwanath Jain Temple, Sowcarpet, Chennai
    INSERT INTO temples (
        id,
        organization_id,
        city_id,
        name,
        slug,
        address,
        timezone,
        pooja_start_time,
        pooja_end_time,
        daily_family_capacity,
        registration_enabled,
        rolling_booking_months,
        booking_cutoff_time,
        closure_rules,
        status
    )
    VALUES (
        '33333333-3333-3333-3333-333333333332'::uuid,
        org_id,
        chennai_city_id,
        'Shri Shankheshwar Parshwanath Jain Temple',
        'shankheshwar-sowcarpet-chennai',
        'Mint Street, Sowcarpet, Chennai, Tamil Nadu 600079',
        'Asia/Kolkata',
        '06:30:00',
        '08:30:00',
        20,
        TRUE,
        6,
        '18:00:00',
        '{"closed_days_of_week": [], "closure_reason": "Open all 7 days with prior family pooja registration"}'::jsonb,
        'active'
    )
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        daily_family_capacity = EXCLUDED.daily_family_capacity,
        updated_at = NOW()
    RETURNING id INTO chennai_temple_id;

    -- 4. Initial Audit Log Entry for System Initialization
    INSERT INTO audit_logs (
        id,
        actor_user_id,
        organization_id,
        temple_id,
        entity_type,
        entity_id,
        action,
        before_data,
        after_data
    )
    VALUES (
        gen_random_uuid(),
        NULL,
        org_id,
        '33333333-3333-3333-3333-333333333331'::uuid,
        'temple',
        '33333333-3333-3333-3333-333333333331',
        'SEED_INITIALIZATION',
        NULL,
        jsonb_build_object(
            'event', 'Initial Chickpet temple seeded with 15 family capacity and 06:00-08:00 Pooja timing',
            'seeded_by', 'system_migration_runner'
        )
    );

END $$;
