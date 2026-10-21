import { Organization, City, Temple, Profile, TempleMembership, AuditLog } from '../types/database';

export const INITIAL_ORGANIZATION: Organization = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Shree Jain Shwetambar Murtipujak Trust Federation',
  slug: 'jain-trust-federation',
  status: 'active',
  created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
};

export const INITIAL_CITIES: City[] = [
  {
    id: '22222222-2222-2222-2222-222222222221',
    organization_id: INITIAL_ORGANIZATION.id,
    name: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    timezone: 'Asia/Kolkata',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    organization_id: INITIAL_ORGANIZATION.id,
    name: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    timezone: 'Asia/Kolkata',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

export const INITIAL_TEMPLES: Temple[] = [
  {
    id: '33333333-3333-3333-3333-333333333331',
    organization_id: INITIAL_ORGANIZATION.id,
    city_id: '22222222-2222-2222-2222-222222222221', // Bengaluru
    name: 'Shri Adinath Bhagwan Jain Shwetambar Temple',
    slug: 'adinath-chickpet-bengaluru',
    address: 'Chickpet Main Road, Near Old Tharagupet, Bengaluru, Karnataka 560053',
    timezone: 'Asia/Kolkata',
    pooja_start_time: '06:00:00',
    pooja_end_time: '08:00:00',
    daily_family_capacity: 15,
    registration_enabled: true,
    rolling_booking_months: 6,
    booking_cutoff_time: '18:00:00',
    closure_rules: {
      closed_days_of_week: [0], // Sunday
      closure_reason: 'Sunday trust sanctuary maintenance and Snatra rituals',
    },
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333332',
    organization_id: INITIAL_ORGANIZATION.id,
    city_id: '22222222-2222-2222-2222-222222222222', // Chennai
    name: 'Shri Shankheshwar Parshwanath Jain Temple',
    slug: 'shankheshwar-sowcarpet-chennai',
    address: 'Mint Street, Sowcarpet, Chennai, Tamil Nadu 600079',
    timezone: 'Asia/Kolkata',
    pooja_start_time: '06:30:00',
    pooja_end_time: '08:30:00',
    daily_family_capacity: 20,
    registration_enabled: true,
    rolling_booking_months: 6,
    booking_cutoff_time: '18:00:00',
    closure_rules: {
      closed_days_of_week: [],
      closure_reason: 'Open all 7 days with prior family pooja registration',
    },
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

export const INITIAL_PROFILES: Profile[] = [
  {
    id: '44444444-4444-4444-4444-444444444441',
    full_name: 'Shrenikbhai J. Shah',
    verified_mobile: '+919845012345',
    locality: 'Sadashivanagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444442',
    full_name: 'Mahendrakumar R. Mehta',
    verified_mobile: '+919845067890',
    locality: 'Chickpet',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444443',
    full_name: 'Pravinbhai K. Solanki',
    verified_mobile: '+919845099999',
    locality: 'Basavanagudi',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    full_name: 'Aarti & Kirit Doshi Family',
    verified_mobile: '+919845077777',
    locality: 'Jayanagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

export const INITIAL_MEMBERSHIPS: TempleMembership[] = [
  {
    id: '55555555-5555-5555-5555-555555555551',
    user_id: '44444444-4444-4444-4444-444444444441',
    organization_id: INITIAL_ORGANIZATION.id,
    temple_id: null, // Organization-level Superadmin
    role: 'superadmin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555552',
    user_id: '44444444-4444-4444-4444-444444444442',
    organization_id: INITIAL_ORGANIZATION.id,
    temple_id: '33333333-3333-3333-3333-333333333331', // Chickpet Temple Admin
    role: 'temple_admin',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555553',
    user_id: '44444444-4444-4444-4444-444444444443',
    organization_id: INITIAL_ORGANIZATION.id,
    temple_id: '33333333-3333-3333-3333-333333333331', // Chickpet Temple Manager
    role: 'temple_manager',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555554',
    user_id: '44444444-4444-4444-4444-444444444444',
    organization_id: INITIAL_ORGANIZATION.id,
    temple_id: '33333333-3333-3333-3333-333333333331',
    role: 'family',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: '66666666-6666-6666-6666-666666666661',
    actor_user_id: '44444444-4444-4444-4444-444444444441',
    organization_id: INITIAL_ORGANIZATION.id,
    temple_id: '33333333-3333-3333-3333-333333333331',
    entity_type: 'temple',
    entity_id: '33333333-3333-3333-3333-333333333331',
    action: 'INIT_CHICKPET_TEMPLE',
    before_data: null,
    after_data: {
      name: 'Shri Adinath Bhagwan Jain Shwetambar Temple',
      city: 'Bengaluru',
      daily_capacity: 15,
      pooja_window: '06:00:00 - 08:00:00',
      closure_day: 'Sunday',
    },
    created_at: new Date('2026-01-01T08:00:00Z').toISOString(),
    actor_name: 'Shrenikbhai J. Shah (Superadmin)',
  },
  {
    id: '66666666-6666-6666-6666-666666666662',
    actor_user_id: '44444444-4444-4444-4444-444444444441',
    organization_id: INITIAL_ORGANIZATION.id,
    temple_id: '33333333-3333-3333-3333-333333333331',
    entity_type: 'temple_membership',
    entity_id: '55555555-5555-5555-5555-555555555552',
    action: 'ASSIGN_TEMPLE_ADMIN',
    before_data: null,
    after_data: {
      user_id: '44444444-4444-4444-4444-444444444442',
      name: 'Mahendrakumar R. Mehta',
      role: 'temple_admin',
      temple: 'Chickpet',
    },
    created_at: new Date('2026-01-02T10:15:00Z').toISOString(),
    actor_name: 'Shrenikbhai J. Shah (Superadmin)',
  },
  {
    id: '66666666-6666-6666-6666-666666666663',
    actor_user_id: '44444444-4444-4444-4444-444444444442',
    organization_id: INITIAL_ORGANIZATION.id,
    temple_id: '33333333-3333-3333-3333-333333333331',
    entity_type: 'temple_config',
    entity_id: '33333333-3333-3333-3333-333333333331',
    action: 'VERIFY_ROLLING_WINDOW',
    before_data: { rolling_months: 3 },
    after_data: { rolling_months: 6, cutoff_time: '18:00:00' },
    created_at: new Date('2026-01-03T11:30:00Z').toISOString(),
    actor_name: 'Mahendrakumar R. Mehta (Chickpet Admin)',
  },
];

export const DEV_TEST_PERSONAS = [
  {
    title: 'Superadmin (Org-wide)',
    profile: INITIAL_PROFILES[0],
    role: 'superadmin' as const,
    templeId: null,
    templeName: 'All Temples (Global Federation)',
    description: 'Full administrative access to all organizations, cities, and temples.',
  },
  {
    title: 'Temple Admin (Chickpet, Bengaluru)',
    profile: INITIAL_PROFILES[1],
    role: 'temple_admin' as const,
    templeId: '33333333-3333-3333-3333-333333333331',
    templeName: 'Shri Adinath Bhagwan Temple, Chickpet',
    description: 'Manages operational capacity, timings, and staff for Chickpet only.',
  },
  {
    title: 'Temple Manager (Chickpet, Bengaluru)',
    profile: INITIAL_PROFILES[2],
    role: 'temple_manager' as const,
    templeId: '33333333-3333-3333-3333-333333333331',
    templeName: 'Shri Adinath Bhagwan Temple, Chickpet',
    description: 'Day-to-day operational desk with scoped permissions.',
  },
  {
    title: 'Family Devotee User',
    profile: INITIAL_PROFILES[3],
    role: 'family' as const,
    templeId: '33333333-3333-3333-3333-333333333331',
    templeName: 'Shri Adinath Bhagwan Temple, Chickpet',
    description: 'Standard devotee account with personal profile access only.',
  },
];
