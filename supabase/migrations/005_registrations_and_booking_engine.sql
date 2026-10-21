-- ============================================================================
-- Aadi Sparsh — Migration 005: Registrations & Booking Engine
-- Phase 2B: Booking Engine, Concurrency Control & Capacity Management
-- ============================================================================

-- 1. REGISTRATIONS TABLE (Durable Family Pooja Registrations)
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

-- Unique Partial Index: Strictly enforces no duplicate ACTIVE registrations for same user, temple and date
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_user_temple_date 
    ON public.registrations (user_id, temple_id, visit_date) 
    WHERE status = 'upcoming';

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_registrations_temple_date ON public.registrations(temple_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON public.registrations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_number ON public.registrations(registration_number);

-- 2. REGISTRATION EVENTS TABLE (Append-Only Lifecycle History)
CREATE TABLE IF NOT EXISTS public.registration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'rescheduled', 'cancelled')),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_events_registration ON public.registration_events(registration_id, created_at ASC);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_events ENABLE ROW LEVEL SECURITY;

-- Devotee families can read only their own registrations
CREATE POLICY "registrations_select_owner"
    ON public.registrations FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Authorized temple staff can read registrations within their temple scope
CREATE POLICY "registrations_select_staff"
    ON public.registrations FOR SELECT
    TO authenticated
    USING (
        public.is_temple_staff(temple_id)
        OR EXISTS (
            SELECT 1 FROM public.temple_memberships m
            WHERE m.user_id = auth.uid()
              AND m.status = 'active'
              AND m.role = 'superadmin'
        )
    );

-- Prevent unauthorized direct client writes (mutations must pass through transactional RPCs)
CREATE POLICY "registrations_admin_write"
    ON public.registrations FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.temple_memberships m
            WHERE m.user_id = auth.uid()
              AND m.status = 'active'
              AND m.role = 'superadmin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.temple_memberships m
            WHERE m.user_id = auth.uid()
              AND m.status = 'active'
              AND m.role = 'superadmin'
        )
    );

-- Registration events RLS:
CREATE POLICY "reg_events_select_owner"
    ON public.registration_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.registrations r
            WHERE r.id = registration_events.registration_id
              AND r.user_id = auth.uid()
        )
    );

CREATE POLICY "reg_events_select_staff"
    ON public.registration_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.registrations r
            WHERE r.id = registration_events.registration_id
              AND (
                  public.is_temple_staff(r.temple_id)
                  OR EXISTS (
                      SELECT 1 FROM public.temple_memberships m
                      WHERE m.user_id = auth.uid()
                        AND m.status = 'active'
                        AND m.role = 'superadmin'
                  )
              )
        )
    );

-- 4. ATOMIC DATABASE RPC FUNCTIONS

-- Function A: Aggregate Calendar Availability (Privacy safe, no devotee PII)
CREATE OR REPLACE FUNCTION public.get_temple_calendar_availability(
    p_temple_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
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
    IF NOT FOUND THEN
        RETURN;
    END IF;

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

        -- Count active family bookings for this date (aggregate only, zero PII)
        SELECT COUNT(*)::int INTO v_count
        FROM public.registrations
        WHERE temple_id = p_temple_id
          AND visit_date = v_iter_date
          AND status = 'upcoming';

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

-- Function B: Atomic Book Temple Visit (Advisory Lock Serialization + Capacity Enforcement)
CREATE OR REPLACE FUNCTION public.book_temple_visit(
    p_temple_id UUID,
    p_visit_date DATE,
    p_member_count INT,
    p_occasion TEXT,
    p_occasion_date DATE DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- 1. Authenticate caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to book temple visit.';
    END IF;

    -- Verify profile exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
        RAISE EXCEPTION 'Devotee profile not found. Please complete profile registration before booking.';
    END IF;

    -- Validate input fields
    IF p_member_count IS NULL OR p_member_count < 1 THEN
        RAISE EXCEPTION 'Member count must be at least 1 devotee.';
    END IF;

    IF p_occasion NOT IN ('birthday', 'wedding_anniversary', 'family_pooja', 'special_day', 'other') THEN
        RAISE EXCEPTION 'Invalid occasion specified.';
    END IF;

    -- 2. Fetch temple configuration
    SELECT * INTO v_temple FROM public.temples WHERE id = p_temple_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected temple does not exist.';
    END IF;

    IF v_temple.status <> 'active' OR NOT v_temple.registration_enabled THEN
        RAISE EXCEPTION 'This temple is not currently accepting visit bookings.';
    END IF;

    -- 3. Serialization / Atomic Concurrency Control
    -- Advisory xact lock guarantees two competing transactions for (temple, visit_date)
    -- are strictly serialized at the database level!
    PERFORM pg_advisory_xact_lock(hashtext(p_temple_id::text || ':' || p_visit_date::text));

    -- 4. Date validation in temple timezone
    v_tz := COALESCE(v_temple.timezone, 'Asia/Kolkata');
    v_current_local_date := (v_now AT TIME ZONE v_tz)::date;
    v_current_local_time := (v_now AT TIME ZONE v_tz)::time;

    -- Past dates rejected
    IF p_visit_date <= v_current_local_date THEN
        RAISE EXCEPTION 'Past or same-day dates are unavailable. Temple visits must be scheduled in advance.';
    END IF;

    -- Rolling window
    v_max_date := (v_current_local_date + (v_temple.rolling_booking_months || ' months')::interval)::date;
    IF p_visit_date > v_max_date THEN
        RAISE EXCEPTION 'Date is beyond the % month booking calendar window.', v_temple.rolling_booking_months;
    END IF;

    -- Cutoff validation (6:00 PM the day prior)
    IF p_visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time THEN
        RAISE EXCEPTION 'Booking deadline passed. Registrations for tomorrow closed at % temple time.', v_temple.booking_cutoff_time;
    END IF;

    -- Closure rules check (e.g. Sunday = 0)
    v_dow := EXTRACT(DOW FROM p_visit_date)::int;
    IF (v_temple.closure_rules->'closed_days_of_week') @> to_jsonb(v_dow) THEN
        RAISE EXCEPTION 'Temple is closed on this day (%): %', 
            TO_CHAR(p_visit_date, 'Day'), 
            COALESCE(v_temple.closure_rules->>'notice', 'Sanctuary maintenance');
    END IF;

    -- 5. Prevent duplicate active booking
    IF EXISTS (
        SELECT 1 FROM public.registrations
        WHERE user_id = v_user_id
          AND temple_id = p_temple_id
          AND visit_date = p_visit_date
          AND status = 'upcoming'
    ) THEN
        RAISE EXCEPTION 'Your family already has an active reservation for this temple on %.', p_visit_date;
    END IF;

    -- 6. Check capacity (counts active family reservations)
    SELECT COUNT(*) INTO v_active_count
    FROM public.registrations
    WHERE temple_id = p_temple_id
      AND visit_date = p_visit_date
      AND status = 'upcoming';

    IF v_active_count >= v_temple.daily_family_capacity THEN
        RAISE EXCEPTION 'Capacity reached: The maximum of % family reservations has already been filled for %.', 
            v_temple.daily_family_capacity, p_visit_date;
    END IF;

    -- 7. Generate human-readable registration number
    v_reg_number := 'AS-' || UPPER(SUBSTRING(v_temple.slug FROM 1 FOR 3)) || '-' || 
                    TO_CHAR(p_visit_date, 'YYYYMMDD') || '-' || 
                    UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 5));

    -- 8. Insert registration and event in single transaction
    INSERT INTO public.registrations (
        registration_number,
        temple_id,
        user_id,
        visit_date,
        member_count,
        occasion,
        occasion_date,
        remarks,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_reg_number,
        p_temple_id,
        v_user_id,
        p_visit_date,
        p_member_count,
        p_occasion,
        p_occasion_date,
        NULLIF(TRIM(p_remarks), ''),
        'upcoming',
        v_now,
        v_now
    ) RETURNING * INTO v_new_reg;

    INSERT INTO public.registration_events (
        registration_id,
        event_type,
        actor_user_id,
        details,
        created_at
    ) VALUES (
        v_new_reg.id,
        'created',
        v_user_id,
        jsonb_build_object(
            'registration_number', v_reg_number,
            'visit_date', p_visit_date,
            'member_count', p_member_count,
            'occasion', p_occasion
        ),
        v_now
    );

    RETURN to_jsonb(v_new_reg);
END;
$$;

-- Function C: Cancel Family Booking (Releases Slot Safely)
CREATE OR REPLACE FUNCTION public.cancel_family_booking(
    p_registration_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found.';
    END IF;

    IF v_reg.user_id <> v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only cancel your own family registrations.';
    END IF;

    IF v_reg.status <> 'upcoming' THEN
        RAISE EXCEPTION 'Only upcoming registrations can be cancelled.';
    END IF;

    SELECT * INTO v_temple FROM public.temples WHERE id = v_reg.temple_id;
    v_tz := COALESCE(v_temple.timezone, 'Asia/Kolkata');
    v_current_local_date := (v_now AT TIME ZONE v_tz)::date;
    v_current_local_time := (v_now AT TIME ZONE v_tz)::time;

    -- Cancellation cutoff check
    IF v_reg.visit_date <= v_current_local_date OR 
       (v_reg.visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time) THEN
        RAISE EXCEPTION 'Cancellation deadline passed. Cancellations must be made before % temple time on the day prior to visit.', v_temple.booking_cutoff_time;
    END IF;

    UPDATE public.registrations
    SET status = 'cancelled',
        cancellation_reason = NULLIF(TRIM(p_reason), ''),
        cancelled_at = v_now,
        updated_at = v_now
    WHERE id = p_registration_id
    RETURNING * INTO v_updated_reg;

    INSERT INTO public.registration_events (
        registration_id,
        event_type,
        actor_user_id,
        details,
        created_at
    ) VALUES (
        p_registration_id,
        'cancelled',
        v_user_id,
        jsonb_build_object(
            'reason', p_reason,
            'visit_date', v_reg.visit_date
        ),
        v_now
    );

    RETURN to_jsonb(v_updated_reg);
END;
$$;

-- Function D: Reschedule Family Booking (Atomic Rollback-Safe Swap)
CREATE OR REPLACE FUNCTION public.reschedule_family_booking(
    p_registration_id UUID,
    p_new_visit_date DATE,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_old_reg FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original registration not found.';
    END IF;

    IF v_old_reg.user_id <> v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only reschedule your own family registrations.';
    END IF;

    IF v_old_reg.status <> 'upcoming' THEN
        RAISE EXCEPTION 'Only upcoming active registrations can be rescheduled.';
    END IF;

    IF p_new_visit_date = v_old_reg.visit_date THEN
        RAISE EXCEPTION 'The new visit date must be different from the currently booked date.';
    END IF;

    SELECT * INTO v_temple FROM public.temples WHERE id = v_old_reg.temple_id;
    v_tz := COALESCE(v_temple.timezone, 'Asia/Kolkata');
    v_current_local_date := (v_now AT TIME ZONE v_tz)::date;
    v_current_local_time := (v_now AT TIME ZONE v_tz)::time;

    -- Check that cutoff for original booking has not passed
    IF v_old_reg.visit_date <= v_current_local_date OR 
       (v_old_reg.visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time) THEN
        RAISE EXCEPTION 'Rescheduling deadline passed for the current visit. Modifications must be made before % temple time on the day prior to visit.', v_temple.booking_cutoff_time;
    END IF;

    -- Lock the target date to ensure concurrency safety
    PERFORM pg_advisory_xact_lock(hashtext(v_old_reg.temple_id::text || ':' || p_new_visit_date::text));

    -- Validate target date
    IF p_new_visit_date <= v_current_local_date THEN
        RAISE EXCEPTION 'Target date must be a future date.';
    END IF;

    v_max_date := (v_current_local_date + (v_temple.rolling_booking_months || ' months')::interval)::date;
    IF p_new_visit_date > v_max_date THEN
        RAISE EXCEPTION 'Target date is beyond the allowed booking window.';
    END IF;

    IF p_new_visit_date = (v_current_local_date + 1) AND v_current_local_time >= v_temple.booking_cutoff_time THEN
        RAISE EXCEPTION 'Booking deadline passed for tomorrow.';
    END IF;

    v_dow := EXTRACT(DOW FROM p_new_visit_date)::int;
    IF (v_temple.closure_rules->'closed_days_of_week') @> to_jsonb(v_dow) THEN
        RAISE EXCEPTION 'Temple is closed on the requested new date.';
    END IF;

    -- Check if user already has an active registration on target date
    IF EXISTS (
        SELECT 1 FROM public.registrations
        WHERE user_id = v_user_id
          AND temple_id = v_old_reg.temple_id
          AND visit_date = p_new_visit_date
          AND status = 'upcoming'
    ) THEN
        RAISE EXCEPTION 'Your family already has an active reservation for this temple on %.', p_new_visit_date;
    END IF;

    -- Check capacity on new date
    SELECT COUNT(*) INTO v_new_active_count
    FROM public.registrations
    WHERE temple_id = v_old_reg.temple_id
      AND visit_date = p_new_visit_date
      AND status = 'upcoming';

    IF v_new_active_count >= v_temple.daily_family_capacity THEN
        RAISE EXCEPTION 'Target date % has reached maximum capacity (% families).', p_new_visit_date, v_temple.daily_family_capacity;
    END IF;

    -- Mark old registration as rescheduled
    UPDATE public.registrations
    SET status = 'rescheduled',
        rescheduled_at = v_now,
        updated_at = v_now
    WHERE id = p_registration_id;

    -- Generate new registration number
    v_new_reg_number := 'AS-' || UPPER(SUBSTRING(v_temple.slug FROM 1 FOR 3)) || '-' || 
                        TO_CHAR(p_new_visit_date, 'YYYYMMDD') || '-' || 
                        UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 5));

    -- Insert new replacement registration
    INSERT INTO public.registrations (
        registration_number,
        temple_id,
        user_id,
        visit_date,
        member_count,
        occasion,
        occasion_date,
        remarks,
        status,
        original_registration_id,
        created_at,
        updated_at
    ) VALUES (
        v_new_reg_number,
        v_old_reg.temple_id,
        v_user_id,
        p_new_visit_date,
        v_old_reg.member_count,
        v_old_reg.occasion,
        v_old_reg.occasion_date,
        COALESCE(NULLIF(TRIM(p_reason), ''), v_old_reg.remarks),
        'upcoming',
        v_old_reg.id,
        v_now,
        v_now
    ) RETURNING * INTO v_new_reg;

    -- Log events on both records
    INSERT INTO public.registration_events (registration_id, event_type, actor_user_id, details, created_at)
    VALUES (
        v_old_reg.id,
        'rescheduled',
        v_user_id,
        jsonb_build_object('rescheduled_to_date', p_new_visit_date, 'replacement_id', v_new_reg.id, 'reason', p_reason),
        v_now
    );

    INSERT INTO public.registration_events (registration_id, event_type, actor_user_id, details, created_at)
    VALUES (
        v_new_reg.id,
        'created',
        v_user_id,
        jsonb_build_object('rescheduled_from_id', v_old_reg.id, 'rescheduled_from_date', v_old_reg.visit_date),
        v_now
    );

    RETURN to_jsonb(v_new_reg);
END;
$$;

-- 5. FUNCTION EXECUTION PRIVILEGES
GRANT EXECUTE ON FUNCTION public.get_temple_calendar_availability(UUID, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_temple_visit(UUID, DATE, INT, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_family_booking(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_family_booking(UUID, DATE, TEXT) TO authenticated;
