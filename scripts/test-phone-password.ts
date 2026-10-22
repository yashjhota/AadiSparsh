/**
 * Aadi Sparsh — Mobile & Password Authentication Verification Suite
 * Verifies unified phone & password sign-in, auto-registration, role resolution,
 * password validation, and security boundaries.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { devStore, aadiSparshRepository } from '../src/lib/supabase';

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

async function runPhonePasswordTests() {
  console.log('================================================================');
  console.log('Aadi Sparsh — Mobile Number & Password Verification Suite');
  console.log('Testing: Phone + Password Auth, Auto-Registration & Role Resolution');
  console.log('================================================================\n');

  // --- Suite 1: Migration 006 & Schema Integrity ---
  console.log('--- Suite 1: Migration 006 & Schema Integrity ---');
  const migration006Path = path.resolve(__dirname, '../supabase/migrations/006_phone_password_auth.sql');
  assert(fs.existsSync(migration006Path), 'Migration 006_phone_password_auth.sql exists');

  const sql006 = fs.readFileSync(migration006Path, 'utf8');
  assert(sql006.includes('handle_new_user()'), 'handle_new_user() trigger function declared');
  assert(sql006.includes('get_authenticated_user_role()'), 'get_authenticated_user_role() RPC function declared');
  assert(sql006.includes('auth.users'), 'Trigger is bound to auth.users table');

  const fullSchemaPath = path.resolve(__dirname, '../supabase/full_schema_migration.sql');
  const fullSql = fs.readFileSync(fullSchemaPath, 'utf8');
  assert(fullSql.includes('006_phone_password_auth.sql') && fullSql.includes('get_authenticated_user_role'), 'full_schema_migration.sql is synced with Migration 006');

  // --- Suite 2: Valid Credential Sign-In & Role Detection ---
  console.log('\n--- Suite 2: Valid Credential Sign-In & Role Detection ---');
  // 2.1 Superadmin Sign-In
  const superadminRes = await aadiSparshRepository.signInWithPhonePassword(
    '+919845012345',
    'AadiSparsh@2026'
  );
  assert(superadminRes.success, 'Superadmin sign in succeeds');
  assert(superadminRes.role === 'superadmin', 'Role detected as superadmin');
  assert(superadminRes.user?.full_name === 'Shrenikbhai J. Shah', 'Profile resolved for superadmin');

  // 2.2 Temple Admin Sign-In
  const adminRes = await aadiSparshRepository.signInWithPhonePassword(
    '+919845067890',
    'AadiSparsh@2026'
  );
  assert(adminRes.success, 'Temple Admin sign in succeeds');
  assert(adminRes.role === 'temple_admin', 'Role detected as temple_admin');
  assert(adminRes.templeId === '33333333-3333-3333-3333-333333333331', 'Scoped to Chickpet temple');

  // 2.3 Temple Manager Sign-In
  const managerRes = await aadiSparshRepository.signInWithPhonePassword(
    '+919845099999',
    'AadiSparsh@2026'
  );
  assert(managerRes.success, 'Temple Manager sign in succeeds');
  assert(managerRes.role === 'temple_manager', 'Role detected as temple_manager');

  // 2.4 Existing Devotee Family Sign-In
  const familyRes = await aadiSparshRepository.signInWithPhonePassword(
    '+919845077777',
    'AadiSparsh@2026'
  );
  assert(familyRes.success, 'Existing devotee family sign in succeeds');
  assert(familyRes.role === 'family', 'Role detected as family');
  assert(familyRes.user?.full_name === 'Aarti & Kirit Doshi Family', 'Family name resolved');

  // --- Suite 3: Password Verification & Error Handling ---
  console.log('\n--- Suite 3: Password Verification & Error Handling ---');
  // 3.1 Wrong password for existing account
  const wrongPwRes = await aadiSparshRepository.signInWithPhonePassword(
    '+919845012345',
    'WrongPassword123'
  );
  assert(!wrongPwRes.success, 'Sign-in fails with incorrect password');
  assert(Boolean(wrongPwRes.error?.includes('Incorrect password') || wrongPwRes.error?.includes('credentials')), 'Error mentions incorrect password');

  // --- Suite 4: Seamless Auto-Registration for New Numbers ---
  console.log('\n--- Suite 4: Seamless Auto-Registration for New Numbers ---');
  const newPhone = '+919988776655';
  const newFamilyName = 'Kantilal B. Jain Family';
  const regRes = await aadiSparshRepository.signInWithPhonePassword(
    newPhone,
    'SecurePass@2026',
    newFamilyName
  );
  assert(regRes.success, 'Auto-registration succeeds for new phone number');
  assert(regRes.isNewUser === true, 'Flagged as new user');
  assert(regRes.role === 'family', 'Newly registered account has family role (no elevated permissions)');
  assert(regRes.user?.verified_mobile === newPhone, 'Verified mobile number recorded');
  assert(regRes.user?.full_name === newFamilyName, 'Full name recorded on profile');

  // 4.2 Subsequent sign-in with the newly registered password
  const subRes = await aadiSparshRepository.signInWithPhonePassword(
    newPhone,
    'SecurePass@2026'
  );
  assert(subRes.success, 'Subsequent sign-in with newly registered password succeeds');
  assert(subRes.isNewUser === false, 'Flagged as existing returning user');
  assert(subRes.user?.full_name === newFamilyName, 'Profile prefilled on return');

  // --- Suite 5: Booking Visit with Newly Registered Account ---
  console.log('\n--- Suite 5: Booking Visit with Newly Registered Account ---');
  const chickpet = devStore.temples[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  while (futureDate.getDay() === 0) {
    futureDate.setDate(futureDate.getDate() + 1);
  }
  const targetDate = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

  const bookingRes = devStore.bookTempleVisit(regRes.user!.id, {
    temple_id: chickpet.id,
    visit_date: targetDate,
    member_count: 4,
    occasion: 'family_pooja',
    remarks: 'Navkar Mantra Jaap morning pooja',
  });
  assert(bookingRes.success && Boolean(bookingRes.data), 'Newly registered mobile user can book a temple visit');
  assert(bookingRes.data?.user_id === regRes.user!.id, 'Booking is linked to authenticated user id');
  assert(bookingRes.data?.status === 'upcoming', 'Booking status is upcoming');

  // Summary
  console.log('\n================================================================');
  console.log(`Phone & Password Verification Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runPhonePasswordTests().catch((err) => {
  console.error('Fatal error in Phone Password test suite:', err);
  process.exit(1);
});
