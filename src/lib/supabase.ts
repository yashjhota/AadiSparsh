import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Organization,
  City,
  Temple,
  Profile,
  TempleMembership,
  AuditLog,
  UserRole,
  FamilyProfileUpdateInput,
  Registration,
  RegistrationEvent,
  DayAvailability,
  CreateBookingInput,
  RescheduleBookingInput,
  CancelBookingInput,
} from '../types/database';
import {
  INITIAL_ORGANIZATION,
  INITIAL_CITIES,
  INITIAL_TEMPLES,
  INITIAL_PROFILES,
  INITIAL_MEMBERSHIPS,
  INITIAL_AUDIT_LOGS,
} from './devData';
import { getKolkataNow, parseLocalDate, formatDateStr } from './dateTime';

const getEnvVar = (name: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[name]) {
      return (import.meta as any).env[name];
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name] || '';
    }
  } catch {
    // ignore
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export type PersistenceMode = 'supabase' | 'unmigrated_supabase' | 'local_sandbox';

// Detect if valid remote Supabase credentials are provided
export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('example.com') &&
    supabaseUrl.startsWith('https://')
  );
};

// Create real client if configured, otherwise create a placeholder client
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/**
 * In-Memory Transactional Store for Development & Verification
 */
class DevMemoryStore {
  private organizations: Organization[] = JSON.parse(JSON.stringify([INITIAL_ORGANIZATION]));
  private cities: City[] = JSON.parse(JSON.stringify(INITIAL_CITIES));
  private temples: Temple[] = JSON.parse(JSON.stringify(INITIAL_TEMPLES));
  private profiles: Profile[] = JSON.parse(JSON.stringify(INITIAL_PROFILES));
  private memberships: TempleMembership[] = JSON.parse(JSON.stringify(INITIAL_MEMBERSHIPS));
  private auditLogs: AuditLog[] = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
  public registrations: Registration[] = [];
  public registrationEvents: RegistrationEvent[] = [];

  // Verified Public Temples (Chickpet Bengaluru is the ONLY verified launch temple)
  getVerifiedPublicTemples(): Temple[] {
    return this.temples
      .filter((t) => t.status === 'active' && t.registration_enabled && t.slug.includes('chickpet'))
      .map((t) => ({
        ...t,
        city: this.cities.find((c) => c.id === t.city_id),
        organization: this.organizations.find((o) => o.id === t.organization_id),
      }));
  }

  getAllTemples(): Temple[] {
    return this.temples.map((t) => ({
      ...t,
      city: this.cities.find((c) => c.id === t.city_id),
      organization: this.organizations.find((o) => o.id === t.organization_id),
    }));
  }

  getOrganizations(): Organization[] {
    return [...this.organizations];
  }

  getCities(): City[] {
    return [...this.cities];
  }

  getTemplesForActor(actorRole: UserRole, actorTempleId?: string | null): Temple[] {
    let result: Temple[] = [];
    if (actorRole === 'superadmin') {
      result = [...this.temples];
    } else if (actorRole === 'temple_admin' || actorRole === 'temple_manager') {
      result = this.temples.filter((t) => t.id === actorTempleId);
    } else {
      result = this.temples.filter((t) => t.status === 'active' && t.registration_enabled && t.slug.includes('chickpet'));
    }

    return result.map((t) => ({
      ...t,
      city: this.cities.find((c) => c.id === t.city_id),
      organization: this.organizations.find((o) => o.id === t.organization_id),
    }));
  }

  updateTemple(
    templeId: string,
    updates: Partial<Temple>,
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): { success: boolean; data?: Temple; error?: string } {
    const isAuthorized =
      actorRole === 'superadmin' ||
      (actorRole === 'temple_admin' && actorTempleId === templeId);

    if (!isAuthorized) {
      return {
        success: false,
        error: `RLS Security Violation: Role '${actorRole}' is not authorized to modify temple '${templeId}'.`,
      };
    }

    const index = this.temples.findIndex((t) => t.id === templeId);
    if (index === -1) {
      return { success: false, error: 'Temple not found.' };
    }

    const beforeData = { ...this.temples[index] };
    const updatedTemple: Temple = {
      ...this.temples[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.temples[index] = updatedTemple;

    this.auditLogs.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      actor_user_id: actorUserId,
      organization_id: updatedTemple.organization_id,
      temple_id: templeId,
      entity_type: 'temple',
      entity_id: templeId,
      action: 'UPDATE_TEMPLE_CONFIG',
      before_data: beforeData as unknown as Record<string, unknown>,
      after_data: updatedTemple as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      actor_name: actorName || 'Authorized Administrator',
    });

    return {
      success: true,
      data: {
        ...updatedTemple,
        city: this.cities.find((c) => c.id === updatedTemple.city_id),
        organization: this.organizations.find((o) => o.id === updatedTemple.organization_id),
      },
    };
  }

  createTemple(
    newTemple: Omit<Temple, 'id' | 'created_at' | 'updated_at'>,
    actorUserId: string,
    actorRole: UserRole,
    actorName?: string
  ): { success: boolean; data?: Temple; error?: string } {
    if (actorRole !== 'superadmin') {
      return {
        success: false,
        error: `RLS Security Violation: Only Superadmin may create new temple tenants.`,
      };
    }

    const created: Temple = {
      ...newTemple,
      id: crypto.randomUUID ? crypto.randomUUID() : `temple-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.temples.push(created);

    this.auditLogs.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      actor_user_id: actorUserId,
      organization_id: created.organization_id,
      temple_id: created.id,
      entity_type: 'temple',
      entity_id: created.id,
      action: 'CREATE_TEMPLE',
      before_data: null,
      after_data: created as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      actor_name: actorName || 'Superadmin',
    });

    return {
      success: true,
      data: {
        ...created,
        city: this.cities.find((c) => c.id === created.city_id),
        organization: this.organizations.find((o) => o.id === created.organization_id),
      },
    };
  }

  createCity(
    newCity: Omit<City, 'id' | 'created_at' | 'updated_at'>,
    actorRole: UserRole
  ): { success: boolean; data?: City; error?: string } {
    if (actorRole !== 'superadmin') {
      return {
        success: false,
        error: `RLS Security Violation: Only Superadmin can add cities.`,
      };
    }

    const created: City = {
      ...newCity,
      id: crypto.randomUUID ? crypto.randomUUID() : `city-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.cities.push(created);
    return { success: true, data: created };
  }

  getMembershipsForActor(actorRole: UserRole, actorTempleId?: string | null): TempleMembership[] {
    let result: TempleMembership[] = [];
    if (actorRole === 'superadmin') {
      result = [...this.memberships];
    } else if (actorRole === 'temple_admin') {
      result = this.memberships.filter((m) => m.temple_id === actorTempleId);
    } else {
      result = [];
    }

    return result.map((m) => ({
      ...m,
      profile: this.profiles.find((p) => p.id === m.user_id),
      temple: this.temples.find((t) => t.id === m.temple_id),
      organization: this.organizations.find((o) => o.id === m.organization_id),
    }));
  }

  assignMembership(
    assignment: {
      userId: string;
      organizationId: string;
      templeId: string | null;
      role: UserRole;
    },
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): { success: boolean; data?: TempleMembership; error?: string } {
    if (actorRole === 'superadmin') {
      // Superadmin authorized
    } else if (actorRole === 'temple_admin') {
      if (assignment.templeId !== actorTempleId) {
        return {
          success: false,
          error: 'RLS Security Violation: Temple Admin cannot assign staff outside their own temple.',
        };
      }
      if (assignment.role === 'superadmin') {
        return {
          success: false,
          error: 'RLS Security Violation: Temple Admin cannot elevate users to Superadmin.',
        };
      }
    } else {
      return {
        success: false,
        error: 'RLS Security Violation: Unauthorized to manage staff memberships.',
      };
    }

    const newMembership: TempleMembership = {
      id: crypto.randomUUID ? crypto.randomUUID() : `mem-${Date.now()}`,
      user_id: assignment.userId,
      organization_id: assignment.organizationId,
      temple_id: assignment.templeId,
      role: assignment.role,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.memberships.push(newMembership);

    this.auditLogs.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      actor_user_id: actorUserId,
      organization_id: assignment.organizationId,
      temple_id: assignment.templeId,
      entity_type: 'temple_membership',
      entity_id: newMembership.id,
      action: 'ASSIGN_STAFF_ROLE',
      before_data: null,
      after_data: newMembership as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      actor_name: actorName || 'Administrator',
    });

    return {
      success: true,
      data: {
        ...newMembership,
        profile: this.profiles.find((p) => p.id === newMembership.user_id),
        temple: this.temples.find((t) => t.id === newMembership.temple_id),
        organization: this.organizations.find((o) => o.id === newMembership.organization_id),
      },
    };
  }

  getAuditLogsForActor(actorRole: UserRole, actorTempleId?: string | null): AuditLog[] {
    if (actorRole === 'superadmin') {
      return [...this.auditLogs];
    }
    if (actorRole === 'temple_admin') {
      return this.auditLogs.filter((l) => l.temple_id === actorTempleId);
    }
    return [];
  }

  getProfiles(): Profile[] {
    return [...this.profiles];
  }

  getProfileById(id: string): Profile | null {
    const found = this.profiles.find((p) => p.id === id);
    return found ? { ...found } : null;
  }

  upsertProfile(userId: string, verifiedPhone: string, input: FamilyProfileUpdateInput): Profile {
    const existingIndex = this.profiles.findIndex((p) => p.id === userId);
    if (existingIndex >= 0) {
      // Profile exists: verified_mobile cannot be changed!
      const current = this.profiles[existingIndex];
      const updated: Profile = {
        ...current,
        full_name: input.full_name.trim(),
        locality: input.locality ? input.locality.trim() : null,
        city: input.city ? input.city.trim() : null,
        state: input.state ? input.state.trim() : null,
        country: input.country ? input.country.trim() : 'India',
        updated_at: new Date().toISOString(),
      };
      this.profiles[existingIndex] = updated;
      return { ...updated };
    } else {
      // New profile for family registration
      const created: Profile = {
        id: userId,
        full_name: input.full_name.trim(),
        verified_mobile: verifiedPhone,
        locality: input.locality ? input.locality.trim() : null,
        city: input.city ? input.city.trim() : null,
        state: input.state ? input.state.trim() : null,
        country: input.country ? input.country.trim() : 'India',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.profiles.push(created);
      return { ...created };
    }
  }

  getCalendarAvailability(templeId: string, startDate: string, endDate: string): DayAvailability[] {
    const temple = this.temples.find((t) => t.id === templeId);
    if (!temple) return [];

    const nowKolkata = getKolkataNow();
    const currDateStr = nowKolkata.dateStr;
    const currTimeStr = nowKolkata.timeStr;

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const result: DayAvailability[] = [];

    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = formatDateStr(curr);
      const dow = curr.getDay(); // 0 = Sunday
      const isPast = dateStr <= currDateStr;

      // Cutoff check for tomorrow's visit (e.g. 6:00 PM local time day prior)
      const tomorrow = new Date(parseLocalDate(currDateStr));
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDateStr(tomorrow);
      const isCutoffPassed = dateStr === tomorrowStr && currTimeStr >= temple.booking_cutoff_time;

      // Closed check
      let isClosed = false;
      let closureReason: string | null = null;
      if (temple.closure_rules.closed_days_of_week.includes(dow)) {
        isClosed = true;
        closureReason = temple.closure_rules.notice || 'Sanctuary maintenance';
      } else if (temple.status !== 'active' || !temple.registration_enabled) {
        isClosed = true;
        closureReason = 'Bookings temporarily suspended';
      }

      // Count active family registrations (status === 'upcoming')
      const activeCount = this.registrations.filter(
        (r) => r.temple_id === templeId && r.visit_date === dateStr && r.status === 'upcoming'
      ).length;

      const capacity = temple.daily_family_capacity;
      const slotsRemaining = Math.max(0, capacity - activeCount);
      const isAvailable = !isPast && !isCutoffPassed && !isClosed && slotsRemaining > 0;

      result.push({
        calendar_date: dateStr,
        active_family_bookings: activeCount,
        capacity,
        slots_remaining: slotsRemaining,
        is_available: isAvailable,
        is_closed: isClosed,
        closure_reason: closureReason,
        is_past: isPast,
        is_cutoff_passed: isCutoffPassed,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return result;
  }

  bookTempleVisit(
    userId: string,
    input: CreateBookingInput
  ): { success: boolean; data?: Registration; error?: string } {
    const profile = this.profiles.find((p) => p.id === userId);
    if (!profile) {
      return { success: false, error: 'Devotee profile not found. Please complete profile registration before booking.' };
    }

    if (!input.member_count || input.member_count < 1) {
      return { success: false, error: 'Member count must be at least 1 devotee.' };
    }

    const temple = this.temples.find((t) => t.id === input.temple_id);
    if (!temple) {
      return { success: false, error: 'Selected temple does not exist.' };
    }

    if (temple.status !== 'active' || !temple.registration_enabled) {
      return { success: false, error: 'This temple is not currently accepting visit bookings.' };
    }

    const nowKolkata = getKolkataNow();
    const currDateStr = nowKolkata.dateStr;
    const currTimeStr = nowKolkata.timeStr;

    if (input.visit_date <= currDateStr) {
      return { success: false, error: 'Past or same-day dates are unavailable. Temple visits must be scheduled in advance.' };
    }

    // Rolling window check
    const maxWindowDate = new Date(parseLocalDate(currDateStr));
    maxWindowDate.setMonth(maxWindowDate.getMonth() + temple.rolling_booking_months);
    const maxDateStr = formatDateStr(maxWindowDate);
    if (input.visit_date > maxDateStr) {
      return { success: false, error: `Date is beyond the ${temple.rolling_booking_months} month booking calendar window.` };
    }

    // Cutoff check
    const tomorrow = new Date(parseLocalDate(currDateStr));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateStr(tomorrow);
    if (input.visit_date === tomorrowStr && currTimeStr >= temple.booking_cutoff_time) {
      return { success: false, error: `Booking deadline passed. Registrations for tomorrow closed at ${temple.booking_cutoff_time} temple time.` };
    }

    // Closure rules check
    const dow = parseLocalDate(input.visit_date).getDay();
    if (temple.closure_rules.closed_days_of_week.includes(dow)) {
      return { success: false, error: `Temple is closed on this day: ${temple.closure_rules.notice || 'Closed'}` };
    }

    // Prevent duplicate active booking for same user and visit date
    const existingActive = this.registrations.find(
      (r) => r.user_id === userId && r.temple_id === input.temple_id && r.visit_date === input.visit_date && r.status === 'upcoming'
    );
    if (existingActive) {
      return { success: false, error: `Your family already has an active reservation for this temple on ${input.visit_date}.` };
    }

    // Capacity check: Counts active family reservations (not people)
    const activeCount = this.registrations.filter(
      (r) => r.temple_id === input.temple_id && r.visit_date === input.visit_date && r.status === 'upcoming'
    ).length;

    if (activeCount >= temple.daily_family_capacity) {
      return {
        success: false,
        error: `Capacity reached: The maximum of ${temple.daily_family_capacity} family reservations has already been filled for ${input.visit_date}.`,
      };
    }

    // Human-readable registration number (e.g. AS-CKP-20261025-XXXXX)
    const prefix = temple.slug.includes('chickpet') ? 'CKP' : temple.slug.substring(0, 3).toUpperCase();
    const cleanDate = input.visit_date.replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const regNumber = `AS-${prefix}-${cleanDate}-${randSuffix}`;

    const newReg: Registration = {
      id: crypto.randomUUID ? crypto.randomUUID() : `reg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      registration_number: regNumber,
      temple_id: input.temple_id,
      user_id: userId,
      visit_date: input.visit_date,
      member_count: Number(input.member_count),
      occasion: input.occasion,
      occasion_date: input.occasion_date || null,
      remarks: input.remarks ? input.remarks.trim() : null,
      status: 'upcoming',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      temple,
      profile,
    };

    this.registrations.push(newReg);

    this.registrationEvents.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}`,
      registration_id: newReg.id,
      event_type: 'created',
      actor_user_id: userId,
      details: {
        registration_number: regNumber,
        visit_date: input.visit_date,
        member_count: input.member_count,
        occasion: input.occasion,
      },
      created_at: new Date().toISOString(),
    });

    return { success: true, data: { ...newReg } };
  }

  cancelFamilyBooking(
    userId: string,
    input: CancelBookingInput
  ): { success: boolean; data?: Registration; error?: string } {
    const regIndex = this.registrations.findIndex((r) => r.id === input.registration_id);
    if (regIndex === -1) {
      return { success: false, error: 'Registration not found.' };
    }

    const reg = this.registrations[regIndex];
    if (reg.user_id !== userId) {
      return { success: false, error: 'Unauthorized: You can only cancel your own family registrations.' };
    }

    if (reg.status !== 'upcoming') {
      return { success: false, error: 'Only upcoming registrations can be cancelled.' };
    }

    const temple = this.temples.find((t) => t.id === reg.temple_id);
    const nowKolkata = getKolkataNow();
    const currDateStr = nowKolkata.dateStr;
    const currTimeStr = nowKolkata.timeStr;

    const tomorrow = new Date(parseLocalDate(currDateStr));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateStr(tomorrow);

    if (reg.visit_date <= currDateStr || (reg.visit_date === tomorrowStr && currTimeStr >= (temple?.booking_cutoff_time || '18:00:00'))) {
      return {
        success: false,
        error: `Cancellation deadline passed. Cancellations must be made before ${temple?.booking_cutoff_time || '18:00:00'} temple time on the day prior to visit.`,
      };
    }

    const updated: Registration = {
      ...reg,
      status: 'cancelled',
      cancellation_reason: input.reason ? input.reason.trim() : null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.registrations[regIndex] = updated;

    this.registrationEvents.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}`,
      registration_id: reg.id,
      event_type: 'cancelled',
      actor_user_id: userId,
      details: {
        reason: input.reason,
        visit_date: reg.visit_date,
      },
      created_at: new Date().toISOString(),
    });

    return { success: true, data: { ...updated } };
  }

  rescheduleFamilyBooking(
    userId: string,
    input: RescheduleBookingInput
  ): { success: boolean; data?: Registration; error?: string } {
    const regIndex = this.registrations.findIndex((r) => r.id === input.registration_id);
    if (regIndex === -1) {
      return { success: false, error: 'Original registration not found.' };
    }

    const oldReg = this.registrations[regIndex];
    if (oldReg.user_id !== userId) {
      return { success: false, error: 'Unauthorized: You can only reschedule your own family registrations.' };
    }

    if (oldReg.status !== 'upcoming') {
      return { success: false, error: 'Only upcoming active registrations can be rescheduled.' };
    }

    if (input.new_visit_date === oldReg.visit_date) {
      return { success: false, error: 'The new visit date must be different from the currently booked date.' };
    }

    const temple = this.temples.find((t) => t.id === oldReg.temple_id);
    if (!temple) return { success: false, error: 'Temple not found.' };

    const nowKolkata = getKolkataNow();
    const currDateStr = nowKolkata.dateStr;
    const currTimeStr = nowKolkata.timeStr;

    // Check cutoff for original visit
    const tomorrow = new Date(parseLocalDate(currDateStr));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateStr(tomorrow);

    if (oldReg.visit_date <= currDateStr || (oldReg.visit_date === tomorrowStr && currTimeStr >= temple.booking_cutoff_time)) {
      return {
        success: false,
        error: `Rescheduling deadline passed for current visit. Modifications must be made before ${temple.booking_cutoff_time} temple time on the day prior to visit.`,
      };
    }

    // Validate new visit date
    if (input.new_visit_date <= currDateStr) {
      return { success: false, error: 'Target date must be a future date.' };
    }

    const maxWindowDate = new Date(parseLocalDate(currDateStr));
    maxWindowDate.setMonth(maxWindowDate.getMonth() + temple.rolling_booking_months);
    const maxDateStr = formatDateStr(maxWindowDate);
    if (input.new_visit_date > maxDateStr) {
      return { success: false, error: `Target date is beyond the ${temple.rolling_booking_months} month booking calendar window.` };
    }

    if (input.new_visit_date === tomorrowStr && currTimeStr >= temple.booking_cutoff_time) {
      return { success: false, error: 'Booking deadline passed for tomorrow.' };
    }

    const dow = parseLocalDate(input.new_visit_date).getDay();
    if (temple.closure_rules.closed_days_of_week.includes(dow)) {
      return { success: false, error: `Temple is closed on requested date: ${temple.closure_rules.notice || 'Closed'}` };
    }

    // Check duplicate active reservation on target date
    const existingActive = this.registrations.find(
      (r) => r.user_id === userId && r.temple_id === oldReg.temple_id && r.visit_date === input.new_visit_date && r.status === 'upcoming'
    );
    if (existingActive) {
      return { success: false, error: `Your family already has an active reservation for this temple on ${input.new_visit_date}.` };
    }

    // Check capacity on new date
    const newDateActiveCount = this.registrations.filter(
      (r) => r.temple_id === oldReg.temple_id && r.visit_date === input.new_visit_date && r.status === 'upcoming'
    ).length;

    if (newDateActiveCount >= temple.daily_family_capacity) {
      return { success: false, error: `Target date ${input.new_visit_date} has reached maximum capacity (${temple.daily_family_capacity} families).` };
    }

    // Perform atomic swap
    const oldUpdated: Registration = {
      ...oldReg,
      status: 'rescheduled',
      rescheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.registrations[regIndex] = oldUpdated;

    const prefix = temple.slug.includes('chickpet') ? 'CKP' : temple.slug.substring(0, 3).toUpperCase();
    const cleanDate = input.new_visit_date.replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newRegNumber = `AS-${prefix}-${cleanDate}-${randSuffix}`;

    const newReg: Registration = {
      id: crypto.randomUUID ? crypto.randomUUID() : `reg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      registration_number: newRegNumber,
      temple_id: oldReg.temple_id,
      user_id: userId,
      visit_date: input.new_visit_date,
      member_count: oldReg.member_count,
      occasion: oldReg.occasion,
      occasion_date: oldReg.occasion_date,
      remarks: input.reason ? input.reason.trim() : oldReg.remarks,
      status: 'upcoming',
      original_registration_id: oldReg.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      temple,
      profile: this.profiles.find((p) => p.id === userId),
    };

    this.registrations.push(newReg);

    this.registrationEvents.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-1`,
      registration_id: oldReg.id,
      event_type: 'rescheduled',
      actor_user_id: userId,
      details: {
        rescheduled_to_date: input.new_visit_date,
        replacement_id: newReg.id,
        reason: input.reason,
      },
      created_at: new Date().toISOString(),
    });

    this.registrationEvents.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-2`,
      registration_id: newReg.id,
      event_type: 'created',
      actor_user_id: userId,
      details: {
        rescheduled_from_id: oldReg.id,
        rescheduled_from_date: oldReg.visit_date,
      },
      created_at: new Date().toISOString(),
    });

    return { success: true, data: { ...newReg } };
  }

  getFamilyRegistrations(userId: string): Registration[] {
    return this.registrations
      .filter((r) => r.user_id === userId)
      .sort((a, b) => b.visit_date.localeCompare(a.visit_date))
      .map((r) => ({
        ...r,
        temple: this.temples.find((t) => t.id === r.temple_id),
      }));
  }

  getStaffRegistrations(
    actorRole: UserRole,
    actorTempleId?: string | null,
    filterTempleId?: string | null,
    filterVisitDate?: string
  ): Registration[] {
    let result = [...this.registrations];

    if (actorRole === 'superadmin') {
      if (filterTempleId) {
        result = result.filter((r) => r.temple_id === filterTempleId);
      }
    } else if (actorRole === 'temple_admin' || actorRole === 'temple_manager') {
      result = result.filter((r) => r.temple_id === actorTempleId);
    } else {
      return [];
    }

    if (filterVisitDate) {
      result = result.filter((r) => r.visit_date === filterVisitDate);
    }

    return result
      .sort((a, b) => a.visit_date.localeCompare(b.visit_date))
      .map((r) => ({
        ...r,
        temple: this.temples.find((t) => t.id === r.temple_id),
        profile: this.profiles.find((p) => p.id === r.user_id),
      }));
  }

  resetToSeeds(): void {
    this.organizations = JSON.parse(JSON.stringify([INITIAL_ORGANIZATION]));
    this.cities = JSON.parse(JSON.stringify(INITIAL_CITIES));
    this.temples = JSON.parse(JSON.stringify(INITIAL_TEMPLES));
    this.profiles = JSON.parse(JSON.stringify(INITIAL_PROFILES));
    this.memberships = JSON.parse(JSON.stringify(INITIAL_MEMBERSHIPS));
    this.auditLogs = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
    this.registrations = [];
    this.registrationEvents = [];
  }
}

export const devStore = new DevMemoryStore();

// Track remote table availability
let remoteTablesVerified: boolean | null = null;

export const checkRemoteTablesAvailable = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    remoteTablesVerified = false;
    return false;
  }
  try {
    const { error } = await supabase.from('temples').select('id').limit(1);
    if (error && error.code === 'PGRST205') {
      // Table not found in schema cache
      remoteTablesVerified = false;
      return false;
    }
    remoteTablesVerified = !error;
    return Boolean(remoteTablesVerified);
  } catch {
    remoteTablesVerified = false;
    return false;
  }
};

export const ensureRemoteReady = async (): Promise<boolean> => {
  if (remoteTablesVerified !== null) return remoteTablesVerified;
  return await checkRemoteTablesAvailable();
};

/**
 * Unified Repository Layer with Strict Safe Persistence Checks
 */
export const aadiSparshRepository = {
  getPersistenceMode(): PersistenceMode {
    if (!isSupabaseConfigured()) return 'local_sandbox';
    if (remoteTablesVerified === false) return 'unmigrated_supabase';
    return 'supabase';
  },

  /**
   * Public View: ONLY displays verified launch temples (Chickpet Bengaluru).
   * Unverified demo entries like Chennai are excluded from the public site per Requirement 8.
   */
  async getPublicTemples(): Promise<Temple[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase
          .from('temples')
          .select(`*, city:cities(*), organization:organizations(*)`)
          .eq('status', 'active')
          .eq('registration_enabled', true)
          .ilike('slug', '%chickpet%');

        if (!error && data && data.length > 0) {
          return data as Temple[];
        }
      } catch (err) {
        console.warn('Error reading remote public temples:', err);
      }
    }
    return devStore.getVerifiedPublicTemples();
  },

  async getTemplesForActor(actorRole: UserRole, actorTempleId?: string | null): Promise<Temple[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        let query = supabase.from('temples').select(`*, city:cities(*), organization:organizations(*)`);

        if (actorRole === 'temple_admin' || actorRole === 'temple_manager') {
          if (actorTempleId) {
            query = query.eq('id', actorTempleId);
          }
        }

        const { data, error } = await query;
        if (!error && data) return data as Temple[];
      } catch (err) {
        console.warn('Falling back to dev store for actor temples:', err);
      }
    }
    return devStore.getTemplesForActor(actorRole, actorTempleId);
  },

  async getCities(): Promise<City[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.from('cities').select('*');
        if (!error && data) return data as City[];
      } catch (err) {
        console.warn('Falling back to dev store for cities:', err);
      }
    }
    return devStore.getCities();
  },

  async getOrganizations(): Promise<Organization[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.from('organizations').select('*');
        if (!error && data) return data as Organization[];
      } catch (err) {
        console.warn('Falling back to dev store for organizations:', err);
      }
    }
    return devStore.getOrganizations();
  },

  async getMemberships(actorRole: UserRole, actorTempleId?: string | null): Promise<TempleMembership[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        let query = supabase.from('temple_memberships').select(`*, profile:profiles(*), temple:temples(*), organization:organizations(*)`);
        if (actorRole === 'temple_admin' && actorTempleId) {
          query = query.eq('temple_id', actorTempleId);
        }
        const { data, error } = await query;
        if (!error && data) return data as TempleMembership[];
      } catch (err) {
        console.warn('Falling back to dev store for memberships:', err);
      }
    }
    return devStore.getMembershipsForActor(actorRole, actorTempleId);
  },

  async getAuditLogs(actorRole: UserRole, actorTempleId?: string | null): Promise<AuditLog[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (actorRole === 'temple_admin' && actorTempleId) {
          query = query.eq('temple_id', actorTempleId);
        }
        const { data, error } = await query;
        if (!error && data) return data as AuditLog[];
      } catch (err) {
        console.warn('Falling back to dev store for audit logs:', err);
      }
    }
    return devStore.getAuditLogsForActor(actorRole, actorTempleId);
  },

  /**
   * Safe Persistence Enforcement (Requirement 9):
   * When Supabase credentials are configured, DO NOT silently save into temporary memory!
   * Fail safely with an explicit actionable message if remote tables are not yet migrated.
   */
  async updateTemple(
    templeId: string,
    updates: Partial<Temple>,
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): Promise<{ success: boolean; data?: Temple; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        const available = await checkRemoteTablesAvailable();
        if (!available) {
          return {
            success: false,
            error: 'Persistence Error: Supabase project is connected, but database tables are not yet created. Please run the Phase 1 SQL migration in your Supabase SQL Editor before saving changes.',
          };
        }
      }

      try {
        const { data, error } = await supabase
          .from('temples')
          .update(updates)
          .eq('id', templeId)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data: data as Temple };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    // Local development sandbox only
    return devStore.updateTemple(templeId, updates, actorUserId, actorRole, actorTempleId, actorName);
  },

  async createTemple(
    newTemple: Omit<Temple, 'id' | 'created_at' | 'updated_at'>,
    actorUserId: string,
    actorRole: UserRole,
    actorName?: string
  ): Promise<{ success: boolean; data?: Temple; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        const available = await checkRemoteTablesAvailable();
        if (!available) {
          return {
            success: false,
            error: 'Persistence Error: Database tables not yet migrated in Supabase. Run /supabase/full_schema_migration.sql first.',
          };
        }
      }

      try {
        const { data, error } = await supabase.from('temples').insert(newTemple).select().single();
        if (error) throw error;
        return { success: true, data: data as Temple };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.createTemple(newTemple, actorUserId, actorRole, actorName);
  },

  async createCity(
    newCity: Omit<City, 'id' | 'created_at' | 'updated_at'>,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: City; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        return {
          success: false,
          error: 'Persistence Error: Database tables not yet migrated in Supabase. Run /supabase/full_schema_migration.sql first.',
        };
      }
      try {
        const { data, error } = await supabase.from('cities').insert(newCity).select().single();
        if (error) throw error;
        return { success: true, data: data as City };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.createCity(newCity, actorRole);
  },

  async assignMembership(
    assignment: {
      userId: string;
      organizationId: string;
      templeId: string | null;
      role: UserRole;
    },
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): Promise<{ success: boolean; data?: TempleMembership; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        return {
          success: false,
          error: 'Persistence Error: Database tables not yet migrated in Supabase. Run /supabase/full_schema_migration.sql first.',
        };
      }
      try {
        const { data, error } = await supabase
          .from('temple_memberships')
          .insert({
            user_id: assignment.userId,
            organization_id: assignment.organizationId,
            temple_id: assignment.templeId,
            role: assignment.role,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, data: data as TempleMembership };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.assignMembership(assignment, actorUserId, actorRole, actorTempleId, actorName);
  },

  getProfiles(): Profile[] {
    return devStore.getProfiles();
  },

  async getProfile(userId: string): Promise<{ success: boolean; data?: Profile | null; error?: string }> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        return { success: true, data: data as Profile | null };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return { success: true, data: devStore.getProfileById(userId) };
  },

  async upsertFamilyProfile(
    userId: string,
    verifiedPhone: string,
    input: FamilyProfileUpdateInput
  ): Promise<{ success: boolean; data?: Profile; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        const available = await checkRemoteTablesAvailable();
        if (!available) {
          return {
            success: false,
            error: 'Persistence Error: Supabase database tables not yet migrated. Run schema migrations in Supabase SQL editor before saving profiles.',
          };
        }
      }

      try {
        // Safe check for existing profile to strictly enforce immutability of verified_mobile
        const { data: existing, error: checkError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          // Strictly update only non-mobile fields
          const { data: updated, error: updateError } = await supabase
            .from('profiles')
            .update({
              full_name: input.full_name.trim(),
              locality: input.locality ? input.locality.trim() : null,
              city: input.city ? input.city.trim() : null,
              state: input.state ? input.state.trim() : null,
              country: input.country ? input.country.trim() : 'India',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
            .select()
            .single();

          if (updateError) throw updateError;
          return { success: true, data: updated as Profile };
        } else {
          // First time registration: insert profile with verified_mobile from auth session
          const { data: inserted, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              full_name: input.full_name.trim(),
              verified_mobile: verifiedPhone,
              locality: input.locality ? input.locality.trim() : null,
              city: input.city ? input.city.trim() : null,
              state: input.state ? input.state.trim() : null,
              country: input.country ? input.country.trim() : 'India',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) throw insertError;
          return { success: true, data: inserted as Profile };
        }
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }

    // Local dev sandbox fallback only
    const result = devStore.upsertProfile(userId, verifiedPhone, input);
    return { success: true, data: result };
  },

  async getCalendarAvailability(templeId: string, startDate: string, endDate: string): Promise<DayAvailability[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.rpc('get_temple_calendar_availability', {
          p_temple_id: templeId,
          p_start_date: startDate,
          p_end_date: endDate,
        });
        if (!error && data) {
          return data as DayAvailability[];
        }
      } catch (err) {
        console.warn('Could not query calendar availability from remote Supabase RPC', err);
      }
    }
    return devStore.getCalendarAvailability(templeId, startDate, endDate);
  },

  async bookTempleVisit(
    userId: string,
    input: CreateBookingInput
  ): Promise<{ success: boolean; data?: Registration; error?: string }> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.rpc('book_temple_visit', {
          p_temple_id: input.temple_id,
          p_visit_date: input.visit_date,
          p_member_count: input.member_count,
          p_occasion: input.occasion,
          p_occasion_date: input.occasion_date || null,
          p_remarks: input.remarks || null,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, data: data as Registration };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.bookTempleVisit(userId, input);
  },

  async cancelFamilyBooking(
    userId: string,
    input: CancelBookingInput
  ): Promise<{ success: boolean; data?: Registration; error?: string }> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.rpc('cancel_family_booking', {
          p_registration_id: input.registration_id,
          p_reason: input.reason || null,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, data: data as Registration };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.cancelFamilyBooking(userId, input);
  },

  async rescheduleFamilyBooking(
    userId: string,
    input: RescheduleBookingInput
  ): Promise<{ success: boolean; data?: Registration; error?: string }> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.rpc('reschedule_family_booking', {
          p_registration_id: input.registration_id,
          p_new_visit_date: input.new_visit_date,
          p_reason: input.reason || null,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, data: data as Registration };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.rescheduleFamilyBooking(userId, input);
  },

  async getFamilyRegistrations(userId: string): Promise<Registration[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*, temple:temples(*)')
          .eq('user_id', userId)
          .order('visit_date', { ascending: false });

        if (!error && data) {
          return data as Registration[];
        }
      } catch (err) {
        console.warn('Could not query family registrations from remote Supabase', err);
      }
    }
    return devStore.getFamilyRegistrations(userId);
  },

  async getStaffRegistrations(
    actorRole: UserRole,
    actorTempleId?: string | null,
    filterTempleId?: string | null,
    filterVisitDate?: string
  ): Promise<Registration[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        let query = supabase
          .from('registrations')
          .select('*, temple:temples(*), profile:profiles(*)');

        if (actorRole === 'superadmin') {
          if (filterTempleId) {
            query = query.eq('temple_id', filterTempleId);
          }
        } else if (actorRole === 'temple_admin' || actorRole === 'temple_manager') {
          if (actorTempleId) {
            query = query.eq('temple_id', actorTempleId);
          }
        } else {
          return [];
        }

        if (filterVisitDate) {
          query = query.eq('visit_date', filterVisitDate);
        }

        const { data, error } = await query.order('visit_date', { ascending: true });
        if (!error && data) {
          return data as Registration[];
        }
      } catch (err) {
        console.warn('Could not query staff registrations from remote Supabase', err);
      }
    }
    return devStore.getStaffRegistrations(actorRole, actorTempleId, filterTempleId, filterVisitDate);
  },

  resetSeeds(): void {
    devStore.resetToSeeds();
  },
};

export const db = aadiSparshRepository;
