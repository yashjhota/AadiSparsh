/**
 * Aadi Sparsh — Database and Multi-Tenant Entity Types
 * Matches the Supabase PostgreSQL schema precisely.
 */

export type UserRole = 'superadmin' | 'temple_admin' | 'temple_manager' | 'family';
export type MembershipStatus = 'active' | 'suspended' | 'revoked';
export type OrganizationStatus = 'active' | 'inactive' | 'suspended';
export type TempleStatus = 'active' | 'maintenance' | 'inactive';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  organization_id: string;
  name: string;
  state: string;
  country: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface TempleClosureRules {
  closed_days_of_week: number[]; // 0 = Sunday, 1 = Monday, ...
  closure_reason?: string;
  notice?: string;
}

export interface Temple {
  id: string;
  organization_id: string;
  city_id: string;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  pooja_start_time: string; // "06:00:00"
  pooja_end_time: string;   // "08:00:00"
  daily_family_capacity: number; // default 15
  registration_enabled: boolean;
  rolling_booking_months: number; // default 6
  booking_cutoff_time: string; // "18:00:00"
  closure_rules: TempleClosureRules;
  status: TempleStatus;
  created_at: string;
  updated_at: string;
  // joined fields for UI display
  city?: City;
  organization?: Organization;
}

export interface Profile {
  id: string; // references auth.users(id)
  full_name: string;
  verified_mobile: string;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TempleMembership {
  id: string;
  user_id: string;
  organization_id: string;
  temple_id: string | null; // null for Org-level Superadmin
  role: UserRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
  // joined fields
  profile?: Profile;
  temple?: Temple;
  organization?: Organization;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  organization_id: string;
  temple_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string;
}

/**
 * Phase 2 Booking Architectural Contracts (Documentation & Verification)
 * Strictly declared for architectural readiness without mock booking operations in Phase 1.
 */
export interface Phase2BookingSpecification {
  one_registration_per_family: true;
  default_daily_family_capacity: 15;
  unlimited_members_per_family: true;
  tracks_attending_member_count: true;
  configurable_pooja_timings: true;
  configurable_closure_rules: true;
  rolling_calendar_months: 6;
  booking_cutoff_preceding_day: "18:00:00";
  preserve_cancellation_history: true;
  atomic_concurrency_lock: "PostgreSQL row-level lock or serializable transaction";
  no_duplicate_active_family_dates: true;
  unique_registration_number_format: "AS-{TEMPLE_CODE}-{YEAR}-{SEQUENTIAL}";
}
