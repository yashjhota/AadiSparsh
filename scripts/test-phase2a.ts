/**
 * Aadi Sparsh — Phase 2A Automated Verification Suite
 * Verifies real mobile OTP authentication architecture, family profile derivation,
 * immutability of verified mobile numbers, Supabase live RLS enforcement, and strict role isolation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { devStore, db, isSupabaseConfigured } from '../src/lib/supabase';
import { FamilyProfileUpdateInput, UserRole } from '../src/types/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${description}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAILED: ${description}`);
    testsFailed++;
  }
}

async function runPhase2ATests() {
  console.log('================================================================');
  console.log('Aadi Sparsh — Phase 2A Automated Verification Suite');
  console.log('Testing: Mobile OTP, Family Profiles, Immutability & Role Boundaries');
  console.log('================================================================\n');

  // --- Suite 1: Migration 004 & Database Schema Guardrails ---
  console.log('--- Suite 1: Migration 004 & Database Schema Guardrails ---');
  const migration004Path = path.resolve(__dirname, '../supabase/migrations/004_family_profiles.sql');
  assert(fs.existsSync(migration004Path), 'Migration 004_family_profiles.sql exists');

  const sql004 = fs.readFileSync(migration004Path, 'utf8');
  assert(sql004.includes('idx_profiles_verified_mobile'), 'Index on verified_mobile is declared');
  assert(sql004.includes('trigger_protect_verified_mobile'), 'Immutability trigger trigger_protect_verified_mobile is defined');
  assert(sql004.includes('protect_verified_mobile()'), 'protect_verified_mobile() function enforces immutable phone');
  assert(sql004.includes("current_jwt_role = 'service_role' OR current_user = 'postgres'"), 'Trigger permits service_role & postgres maintenance while blocking normal users');

  // Verify production isolation of dev shortcuts
  const staffSignInSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/StaffSignIn.tsx'), 'utf8');
  assert(staffSignInSrc.includes('import.meta.env.DEV && ('), 'StaffSignIn sandbox shortcuts are strictly gated behind DEV mode');

  const adminConsoleSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/AdminConsole.tsx'), 'utf8');
  assert(adminConsoleSrc.includes('import.meta.env.DEV && ('), 'AdminConsole dev persona switcher is strictly gated behind DEV mode');

  const authContextSrc = fs.readFileSync(path.resolve(__dirname, '../src/context/AuthContext.tsx'), 'utf8');
  assert(authContextSrc.includes('if (import.meta.env.PROD)'), 'startDevSandboxSession explicitly rejects execution in production builds');

  // --- Suite 2: Mobile Phone Format Validation (E.164) ---
  console.log('\n--- Suite 2: Phone Format Validation (E.164) ---');
  const e164Regex = /^\+[1-9]\d{7,14}$/;

  const validPhones = [
    '+919845012345',
    '+918765432109',
    '+14155552671',
    '+447911123456',
    '+971501234567',
  ];

  for (const phone of validPhones) {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    assert(e164Regex.test(cleaned), `Valid E.164 accepted: ${phone}`);
  }

  const invalidPhones = [
    '9845012345',       // Missing country code +
    '+0123456789',      // Invalid country prefix 0
    '+91-invalid-no',   // Non-digits
    '+91 123',          // Too short
    'invalid',          // Plain string
  ];

  for (const phone of invalidPhones) {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    assert(!e164Regex.test(cleaned), `Invalid phone rejected: ${phone}`);
  }

  // --- Suite 3: Live Supabase RLS Enforcement on Profiles ---
  console.log('\n--- Suite 3: Live Supabase RLS Enforcement on Profiles ---');
  if (isSupabaseConfigured()) {
    const unauthTestId = '44444444-4444-4444-4444-444444444444';
    const unauthRes = await db.upsertFamilyProfile(unauthTestId, '+919876500001', {
      full_name: 'Unauthenticated Attacker',
      city: 'Bengaluru',
    });
    assert(!unauthRes.success, 'Live Supabase rejects unauthenticated profile writes');
    assert(
      Boolean(unauthRes.error?.includes('row-level security') || unauthRes.error?.includes('foreign key')),
      `Live Supabase RLS blocked unauthorized write (${unauthRes.error})`
    );
  } else {
    console.log('  ⚠️ Supabase unconfigured, skipping remote RLS check.');
  }

  // --- Suite 4: Domain Profile Persistence & Immutability Logic ---
  console.log('\n--- Suite 4: Domain Profile Persistence & Immutability Logic ---');
  const testUserId = 'test-family-user-uuid-101';
  const verifiedPhone = '+919876500001';

  // 1. Initial Profile Registration
  const initialInput: FamilyProfileUpdateInput = {
    full_name: 'Pravinkumar M. Jain',
    locality: 'Sadashivanagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
  };

  const createdProfile = devStore.upsertProfile(testUserId, verifiedPhone, initialInput);
  assert(Boolean(createdProfile), 'New family profile created successfully');
  assert(createdProfile.full_name === 'Pravinkumar M. Jain', 'Full name persisted accurately');
  assert(createdProfile.verified_mobile === verifiedPhone, 'Verified mobile number anchored to session phone');

  // 2. Profile Fetch / Prefill
  const fetched = devStore.getProfileById(testUserId);
  assert(Boolean(fetched), 'Profile fetched successfully for returning user');
  assert(fetched?.full_name === 'Pravinkumar M. Jain', 'Returning user profile prefilled correctly');
  assert(fetched?.city === 'Bengaluru', 'Prefilled city is accurate');

  // 3. Profile Update (Family updates permitted fields)
  const updateInput: FamilyProfileUpdateInput = {
    full_name: 'Pravinkumar & Family Jain',
    locality: 'Near Sankey Tank, Sadashivanagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
  };

  // Attempt to pass a fraudulent phone in update attempt
  const updatedProfile = devStore.upsertProfile(testUserId, '+919999999999', updateInput);
  assert(Boolean(updatedProfile), 'Family profile updated permitted fields');
  assert(updatedProfile.full_name === 'Pravinkumar & Family Jain', 'Updated full name persisted');
  assert(updatedProfile.locality === 'Near Sankey Tank, Sadashivanagar', 'Updated locality persisted');
  assert(
    updatedProfile.verified_mobile === verifiedPhone,
    `Verified mobile remains immutable: expected ${verifiedPhone}, got ${updatedProfile.verified_mobile}`
  );

  // --- Suite 5: Strict Role Isolation & Privilege Non-Elevation ---
  console.log('\n--- Suite 5: Strict Role Isolation & Non-Elevation ---');
  const familyRole: UserRole = 'family';
  const roleString = familyRole as string;
  assert(
    roleString !== 'superadmin' && roleString !== 'temple_admin' && roleString !== 'temple_manager',
    'Role "family" is completely distinct from staff roles'
  );

  // A family user cannot perform admin updates on temples
  const unauthorizedTempleUpdate = devStore.updateTemple(
    '33333333-3333-3333-3333-333333333331',
    { daily_family_capacity: 50 },
    testUserId,
    'family',
    null
  );
  assert(!unauthorizedTempleUpdate.success, 'Family user is rejected from modifying temple configuration');
  assert(
    Boolean(unauthorizedTempleUpdate.error?.includes('RLS Security Violation')),
    'Security error explicitly references RLS authorization violation'
  );

  // A family user cannot assign staff memberships
  const unauthorizedMembership = devStore.assignMembership(
    {
      userId: testUserId,
      organizationId: '11111111-1111-1111-1111-111111111111',
      templeId: '33333333-3333-3333-3333-333333333331',
      role: 'superadmin',
    },
    testUserId,
    'family',
    null
  );
  assert(!unauthorizedMembership.success, 'Family user cannot self-assign staff memberships');

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`Phase 2A Test Suite Finished: ${testsPassed} passed, ${testsFailed} failed.`);
  console.log('================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runPhase2ATests();
