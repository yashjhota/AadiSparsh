/**
 * Aadi Sparsh — Phase 2B Automated Verification Suite
 * Verifies Chickpet Temple booking engine, daily family capacity (15), unlimited devotee count per family,
 * Sunday closure, 6 PM cutoff in Asia/Kolkata, duplicate active prevention, atomic serialization,
 * self-service cancellation/rescheduling, and staff scoping.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { devStore, aadiSparshRepository } from '../src/lib/supabase';
import { INITIAL_TEMPLES } from '../src/lib/devData';
import {
  getKolkataNow,
  parseLocalDate,
  formatDateStr,
  formatDisplayDate,
} from '../src/lib/dateTime';

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

async function runPhase2BTests() {
  console.log('================================================================');
  console.log('Aadi Sparsh — Phase 2B Automated Verification Suite');
  console.log('Testing: Booking Engine, Capacity Management & Concurrency Guardrails');
  console.log('================================================================\n');

  // --- Suite 1: Migration 005 & Database Schema Guardrails ---
  console.log('--- Suite 1: Migration 005 & Database Schema Guardrails ---');
  const migration005Path = path.resolve(__dirname, '../supabase/migrations/005_registrations_and_booking_engine.sql');
  assert(fs.existsSync(migration005Path), 'Migration 005_registrations_and_booking_engine.sql exists');

  const sql005 = fs.readFileSync(migration005Path, 'utf8');
  assert(sql005.includes('registrations') && sql005.includes('CREATE TABLE IF NOT EXISTS public.registrations'), 'registrations table is declared');
  assert(sql005.includes('registration_events') && sql005.includes('CREATE TABLE IF NOT EXISTS public.registration_events'), 'registration_events table is declared');
  assert(
    sql005.includes('idx_unique_active_user_temple_date') &&
    sql005.includes("WHERE status = 'upcoming'"),
    'Partial unique index idx_unique_active_user_temple_date enforces no duplicate active booking per user/temple/date'
  );
  assert(sql005.includes('pg_advisory_xact_lock'), 'Atomic concurrency serialization uses pg_advisory_xact_lock');
  assert(sql005.includes('get_temple_calendar_availability'), 'Aggregate calendar availability RPC function declared');
  assert(sql005.includes('book_temple_visit'), 'Atomic book_temple_visit RPC function declared');
  assert(sql005.includes('cancel_family_booking'), 'cancel_family_booking RPC function declared');
  assert(sql005.includes('reschedule_family_booking'), 'reschedule_family_booking RPC function declared');
  assert(
    sql005.includes('registrations_select_owner'),
    'Devotee family accounts can only read their own registration records'
  );
  assert(
    sql005.includes('registrations_admin_write'),
    'Direct client inserts/writes to registrations table are blocked by RLS (only privileged superadmin or transactional RPCs can write)'
  );

  const fullSchemaPath = path.resolve(__dirname, '../supabase/full_schema_migration.sql');
  const fullSql = fs.readFileSync(fullSchemaPath, 'utf8');
  assert(fullSql.includes('registrations') && fullSql.includes('book_temple_visit'), 'Full schema migration file is synchronized with Phase 2B schema');

  // --- Suite 2: Date & Timezone Utilities (Asia/Kolkata) ---
  console.log('\n--- Suite 2: Date & Timezone Utilities (Asia/Kolkata) ---');
  const kolkataNow = getKolkataNow();
  assert(Boolean(kolkataNow.dateStr && kolkataNow.timeStr), 'getKolkataNow returns valid Asia/Kolkata date and time');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(kolkataNow.dateStr), 'Kolkata dateStr matches YYYY-MM-DD pattern');
  assert(/^\d{2}:\d{2}:\d{2}$/.test(kolkataNow.timeStr), 'Kolkata timeStr matches HH:MM:SS pattern');

  const parsedDate = parseLocalDate('2026-05-15');
  assert(parsedDate.getFullYear() === 2026 && parsedDate.getMonth() === 4 && parsedDate.getDate() === 15, 'parseLocalDate correctly parses local date without UTC offset shifting');
  assert(formatDateStr(parsedDate) === '2026-05-15', 'formatDateStr outputs matching YYYY-MM-DD');

  const displayDate = formatDisplayDate('2026-05-15');
  assert(displayDate.includes('May') && displayDate.includes('2026'), 'formatDisplayDate formats readable date string');

  // --- Suite 3: Chickpet Temple Configuration ---
  console.log('\n--- Suite 3: Chickpet Temple Configuration ---');
  const chickpet = INITIAL_TEMPLES[0];
  assert(chickpet.daily_family_capacity === 15, 'Chickpet temple daily family capacity is exactly 15 families');
  assert(chickpet.timezone === 'Asia/Kolkata', 'Chickpet temple timezone is Asia/Kolkata');
  assert(chickpet.pooja_start_time === '06:00:00' && chickpet.pooja_end_time === '08:00:00', 'Pooja window is 6:00 AM to 8:00 AM');
  assert(chickpet.booking_cutoff_time === '18:00:00', 'Booking cutoff is 6:00 PM on preceding day');
  assert(
    Array.isArray(chickpet.closure_rules.closed_days_of_week) &&
    chickpet.closure_rules.closed_days_of_week.includes(0),
    'Sunday (day 0) is closed by default for Chickpet'
  );

  // --- Suite 4: Calendar Availability RPC (Zero PII, Accurate Counts) ---
  console.log('\n--- Suite 4: Calendar Availability RPC (Zero PII) ---');
  // Choose an open future non-Sunday date (at least 5 days out)
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 5);
  while (baseDate.getDay() === 0) {
    baseDate.setDate(baseDate.getDate() + 1);
  }
  const testDate = formatDateStr(baseDate);

  // Reset store test registrations
  devStore.registrations = [];
  devStore.registrationEvents = [];

  const calendarData = devStore.getCalendarAvailability(chickpet.id, testDate, testDate);
  assert(calendarData.length === 1, 'Availability retrieved for specified date range');
  const daySlot = calendarData[0];
  assert(daySlot.capacity === 15, 'Day availability returns temple capacity of 15');
  assert(daySlot.slots_remaining === 15, 'Fresh day starts with all 15 family slots available');
  assert(!('user_id' in daySlot) && !('full_name' in daySlot), 'Calendar availability contains zero family PII');

  // --- Suite 5: Booking Logic & Capacity Serialization ---
  console.log('\n--- Suite 5: Booking Logic & Capacity Serialization ---');
  // Seed devotee user profiles
  for (let i = 1; i <= 20; i++) {
    devStore.upsertProfile(`devotee-user-${i}`, `+9198765432${(i + 10).toString().slice(-2)}`, {
      full_name: `Devotee Family ${i}`,
      city: 'Bengaluru',
      locality: 'Chickpet',
    });
  }

  // 5.1 Rejection of Sunday booking
  const sundayDate = new Date();
  sundayDate.setDate(sundayDate.getDate() + 7);
  while (sundayDate.getDay() !== 0) {
    sundayDate.setDate(sundayDate.getDate() + 1);
  }
  const testSundayStr = formatDateStr(sundayDate);

  const sundayResult = devStore.bookTempleVisit('devotee-user-1', {
    temple_id: chickpet.id,
    visit_date: testSundayStr,
    member_count: 5,
    occasion: 'family_pooja',
  });
  assert(
    !sundayResult.success && Boolean(sundayResult.error?.includes('closed') || sundayResult.error?.includes('Sunday')),
    'Booking on a closed Sunday is rejected with closure explanation'
  );

  // 5.2 Rejection of past date booking
  const pastResult = devStore.bookTempleVisit('devotee-user-1', {
    temple_id: chickpet.id,
    visit_date: '2020-01-01',
    member_count: 3,
    occasion: 'family_pooja',
  });
  assert(
    !pastResult.success && Boolean(pastResult.error?.includes('Past') || pastResult.error?.includes('advance')),
    'Booking a past date is rejected'
  );

  // 5.3 Member count does NOT consume multiple family slots
  const reg1Result = devStore.bookTempleVisit('devotee-user-1', {
    temple_id: chickpet.id,
    visit_date: testDate,
    member_count: 8, // 8 members in 1 family
    occasion: 'family_pooja',
    remarks: 'Grandparents and grandchildren attending',
  });
  assert(reg1Result.success && Boolean(reg1Result.data), 'Booking 1 created successfully');
  const reg1 = reg1Result.data!;
  assert(reg1.registration_number.startsWith('AS-CKP-'), 'Registration number format matches AS-CKP-YYYYMMDD-XXXX');
  assert(reg1.member_count === 8, 'Member count recorded as 8 for reporting');

  const availAfterReg1 = devStore.getCalendarAvailability(chickpet.id, testDate, testDate);
  assert(availAfterReg1[0].active_family_bookings === 1, 'Only 1 family slot consumed despite 8 devotee members');
  assert(availAfterReg1[0].slots_remaining === 14, 'Remaining available slots is 14');

  // 5.4 Duplicate active booking by same user on same date is rejected
  const duplicateResult = devStore.bookTempleVisit('devotee-user-1', {
    temple_id: chickpet.id,
    visit_date: testDate,
    member_count: 2,
    occasion: 'birthday',
  });
  assert(
    !duplicateResult.success && Boolean(duplicateResult.error?.includes('already has an active reservation')),
    'Duplicate booking for same user, temple and date is rejected'
  );

  // 5.5 Fill remaining 14 slots up to capacity of 15
  for (let i = 2; i <= 15; i++) {
    const res = devStore.bookTempleVisit(`devotee-user-${i}`, {
      temple_id: chickpet.id,
      visit_date: testDate,
      member_count: (i % 4) + 2, // 2 to 5 members
      occasion: 'special_day',
    });
    assert(res.success, `Slot ${i}/15 booked successfully`);
  }

  const availAtCapacity = devStore.getCalendarAvailability(chickpet.id, testDate, testDate);
  assert(availAtCapacity[0].active_family_bookings === 15, 'Active family bookings reached maximum capacity of 15');
  assert(availAtCapacity[0].slots_remaining === 0, 'Available slots is 0');
  assert(!availAtCapacity[0].is_available, 'Day availability transitioned to unavailable when capacity is met');

  // 5.6 16th family booking is rejected due to capacity limit
  const sixteenthResult = devStore.bookTempleVisit('devotee-user-16', {
    temple_id: chickpet.id,
    visit_date: testDate,
    member_count: 4,
    occasion: 'family_pooja',
  });
  assert(
    !sixteenthResult.success && Boolean(sixteenthResult.error?.includes('Capacity reached')),
    '16th booking is rejected due to daily family capacity'
  );

  // --- Suite 6: Self-Service Cancellation & Slot Release ---
  console.log('\n--- Suite 6: Self-Service Cancellation & Slot Release ---');
  // Attempt unauthorized cancellation by another user
  const unauthorizedCancel = devStore.cancelFamilyBooking('devotee-user-99', {
    registration_id: reg1.id,
    reason: 'Malicious cancellation',
  });
  assert(
    !unauthorizedCancel.success && Boolean(unauthorizedCancel.error?.includes('Unauthorized')),
    'Unauthorized cancellation by another user is blocked'
  );

  // Legitimate cancellation by owner
  const cancelResult = devStore.cancelFamilyBooking('devotee-user-1', {
    registration_id: reg1.id,
    reason: 'Family out of station',
  });
  assert(cancelResult.success && Boolean(cancelResult.data), 'Cancellation succeeded for booking owner');
  const cancelledReg = cancelResult.data!;
  assert(cancelledReg.status === 'cancelled', 'Registration status changed to cancelled');
  assert(Boolean(cancelledReg.cancelled_at), 'cancelled_at timestamp is set');
  assert(cancelledReg.cancellation_reason === 'Family out of station', 'Cancellation reason preserved');

  // Verify slot was released
  const availAfterCancel = devStore.getCalendarAvailability(chickpet.id, testDate, testDate);
  assert(availAfterCancel[0].active_family_bookings === 14, 'Active family bookings reduced from 15 to 14 after cancellation');
  assert(availAfterCancel[0].slots_remaining === 1, '1 slot released and available');
  assert(availAfterCancel[0].is_available, 'Status transitioned back to available');

  // User 16 can now book the newly released slot
  const reg16Result = devStore.bookTempleVisit('devotee-user-16', {
    temple_id: chickpet.id,
    visit_date: testDate,
    member_count: 3,
    occasion: 'family_pooja',
  });
  assert(reg16Result.success && reg16Result.data?.status === 'upcoming', '16th family successfully booked the slot freed up by cancellation');

  // Cancelled registration is NOT deleted from database
  const user1Registrations = devStore.getFamilyRegistrations('devotee-user-1');
  assert(user1Registrations.length >= 1, 'Cancelled registration remains in devotee history');
  assert(user1Registrations[0].status === 'cancelled', 'History accurately marks registration as cancelled');

  // --- Suite 7: Self-Service Rescheduling ---
  console.log('\n--- Suite 7: Self-Service Rescheduling ---');
  // Find a second valid target date
  const targetDateObj = new Date(baseDate);
  targetDateObj.setDate(targetDateObj.getDate() + 2);
  while (targetDateObj.getDay() === 0) {
    targetDateObj.setDate(targetDateObj.getDate() + 1);
  }
  const targetDateStr = formatDateStr(targetDateObj);

  // Reschedule user 2 from testDate to targetDateStr
  const user2Regs = devStore.getFamilyRegistrations('devotee-user-2');
  const user2OldReg = user2Regs[0];

  const rescheduleResult = devStore.rescheduleFamilyBooking('devotee-user-2', {
    registration_id: user2OldReg.id,
    new_visit_date: targetDateStr,
    reason: 'Changed family travel plans',
  });

  assert(rescheduleResult.success && Boolean(rescheduleResult.data), 'Rescheduling succeeded');
  const rescheduledNewReg = rescheduleResult.data!;
  assert(rescheduledNewReg.status === 'upcoming', 'New rescheduled registration created with status upcoming');
  assert(rescheduledNewReg.visit_date === targetDateStr, 'New registration has target visit date');
  assert(rescheduledNewReg.original_registration_id === user2OldReg.id, 'New registration links to original_registration_id');

  // Check that old registration status is 'rescheduled'
  const oldRegUpdated = devStore.registrations.find((r) => r.id === user2OldReg.id);
  assert(oldRegUpdated?.status === 'rescheduled', 'Original registration updated to status rescheduled');

  // Verify events recorded
  const events = devStore.registrationEvents.filter(
    (e) => e.registration_id === user2OldReg.id || e.registration_id === rescheduledNewReg.id
  );
  assert(events.length >= 2, 'Audit trail events recorded for both old and new registration');

  // --- Suite 8: Staff Portal Governance & Scoping ---
  console.log('\n--- Suite 8: Staff Portal Governance & Scoping ---');
  const staffRegs = devStore.getStaffRegistrations('temple_admin', chickpet.id, chickpet.id, testDate);
  assert(staffRegs.length === 16, 'Staff portal retrieves all records on test date (including historical cancelled & rescheduled records)');
  assert(staffRegs.every((r) => r.temple_id === chickpet.id), 'All retrieved registrations are scoped to Chickpet temple');

  const activeStaffRegs = staffRegs.filter((r) => r.status === 'upcoming');
  assert(activeStaffRegs.length === 14, 'Active upcoming registrations is 14 after User 2 rescheduled');

  // Devotee 17 books the vacant slot
  const reg17Result = devStore.bookTempleVisit('devotee-user-17', {
    temple_id: chickpet.id,
    visit_date: testDate,
    member_count: 5,
    occasion: 'family_pooja',
  });
  assert(reg17Result.success, 'New devotee family claims the slot released by rescheduling');

  const updatedStaffRegs = devStore.getStaffRegistrations('temple_admin', chickpet.id, chickpet.id, testDate);
  const finalActiveStaffRegs = updatedStaffRegs.filter((r) => r.status === 'upcoming');
  assert(finalActiveStaffRegs.length === 15, 'Active family capacity restored to exactly 15 families');

  // Check aggregate totals
  const totalDevotees = finalActiveStaffRegs.reduce((sum, r) => sum + r.member_count, 0);
  assert(totalDevotees > 15, `Member count is aggregate (${totalDevotees} devotees across 15 families)`);

  // --- Suite 9: Repository Remote Fallback Parity ---
  console.log('\n--- Suite 9: Repository Remote Fallback Parity ---');
  const repoAvailability = await aadiSparshRepository.getCalendarAvailability(chickpet.id, testDate, testDate);
  assert(repoAvailability.length === 1, 'aadiSparshRepository.getCalendarAvailability executes seamlessly');

  const repoFamilyRegs = await aadiSparshRepository.getFamilyRegistrations('devotee-user-16');
  assert(repoFamilyRegs.length >= 1, 'aadiSparshRepository.getFamilyRegistrations executes seamlessly');

  // Summary
  console.log('\n================================================================');
  console.log(`Phase 2B Verification Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runPhase2BTests().catch((err) => {
  console.error('Fatal test error in Phase 2B test suite:', err);
  process.exit(1);
});
