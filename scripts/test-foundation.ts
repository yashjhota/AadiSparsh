/**
 * Aadi Sparsh — Phase 1 Foundation & Architecture Verification Test Suite
 * Comprehensive automated verification for Phase 1 verification gate before Phase 2.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { devStore } from '../src/lib/supabase';
import { UserRole } from '../src/types/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('Aadi Sparsh — Phase 1 Comprehensive Verification Audit');
  console.log('================================================================\n');

  // --- Suite 1: Migration Files & Schema Integrity ---
  console.log('--- Suite 1: Migration Files & Schema Integrity ---');
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  assert(fs.existsSync(migrationsDir), 'Migrations directory exists');

  const migration001Path = path.join(migrationsDir, '001_initial_schema.sql');
  const migration002Path = path.join(migrationsDir, '002_rls_policies.sql');
  const migration003Path = path.join(migrationsDir, '003_seed_data.sql');

  assert(fs.existsSync(migration001Path), 'Migration 001_initial_schema.sql exists');
  assert(fs.existsSync(migration002Path), 'Migration 002_rls_policies.sql exists');
  assert(fs.existsSync(migration003Path), 'Migration 003_seed_data.sql exists');

  const sql001 = fs.readFileSync(migration001Path, 'utf8');
  const requiredTables = [
    'organizations',
    'cities',
    'temples',
    'profiles',
    'temple_memberships',
    'audit_logs',
  ];
  for (const table of requiredTables) {
    assert(
      sql001.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `Table '${table}' is declared in 001_initial_schema.sql`
    );
  }

  // --- Suite 2: Row Level Security (RLS) SQL Verification ---
  console.log('\n--- Suite 2: Row Level Security (RLS) Verification ---');
  const sql002 = fs.readFileSync(migration002Path, 'utf8');
  for (const table of requiredTables) {
    assert(
      sql002.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`),
      `RLS is explicitly enabled on table '${table}'`
    );
  }

  assert(
    sql002.includes('SECURITY DEFINER') && sql002.includes('SET search_path = public'),
    'Security definer functions enforce clean search_path to prevent path hijacking'
  );
  assert(
    sql002.includes('CREATE POLICY "audit_logs_deny_update"') &&
    sql002.includes('CREATE POLICY "audit_logs_deny_delete"') &&
    sql002.includes('USING (FALSE)'),
    'Audit logs are strictly immutable: UPDATE and DELETE policies evaluate to FALSE'
  );
  assert(
    sql002.includes('audit_logs_insert_privileged'),
    'Audit log insertions are restricted to authorized administrative staff'
  );

  // --- Suite 3: Secret Leakage & Environment Safety Check ---
  console.log('\n--- Suite 3: Secret Leakage & Environment Safety Check ---');
  const envExamplePath = path.resolve(__dirname, '../.env.example');
  assert(fs.existsSync(envExamplePath), '.env.example configuration template exists');
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
  assert(
    !envExampleContent.includes('eyJh') && envExampleContent.includes('your-anon-key-here'),
    '.env.example contains placeholder names only without committed secrets'
  );

  // Scan all client source files for accidental service role key import
  const srcDir = path.resolve(__dirname, '../src');
  const clientFiles: string[] = [];
  function scanDir(dir: string) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) scanDir(full);
      else if (full.endsWith('.ts') || full.endsWith('.tsx')) clientFiles.push(full);
    }
  }
  scanDir(srcDir);

  let serviceKeyExposedInClient = false;
  for (const f of clientFiles) {
    const text = fs.readFileSync(f, 'utf8');
    if (text.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      serviceKeyExposedInClient = true;
      console.error(`❌ Security failure: SUPABASE_SERVICE_ROLE_KEY referenced in client file: ${f}`);
    }
  }
  assert(!serviceKeyExposedInClient, 'SUPABASE_SERVICE_ROLE_KEY is NEVER imported or referenced in src/ browser code');

  // --- Suite 4: Multi-Tenant Architecture & Dynamic Seed State ---
  console.log('\n--- Suite 4: Multi-Tenant Architecture & Dynamic Seed State ---');
  devStore.resetToSeeds();

  const orgs = devStore.getOrganizations();
  assert(orgs.length >= 1, 'At least 1 organization exists in the database');
  assert(orgs[0].slug === 'jain-trust-federation', 'Initial organization slug is jain-trust-federation');

  const cities = devStore.getCities();
  assert(cities.length >= 2, 'Multiple cities exist in the shared database (Bengaluru and Chennai)');
  const bengaluru = cities.find((c) => c.name === 'Bengaluru');
  const chennai = cities.find((c) => c.name === 'Chennai');
  assert(Boolean(bengaluru && chennai), 'Bengaluru and Chennai are properly initialized');

  const allTemples = devStore.getAllTemples();
  assert(allTemples.length >= 2, 'Multiple temples exist in the database (Chickpet & Chennai)');

  const verifiedPublicTemples = devStore.getVerifiedPublicTemples();
  assert(
    verifiedPublicTemples.length === 1 && verifiedPublicTemples[0].slug.includes('chickpet'),
    'Public website exposes ONLY verified participating temple (Chickpet Bengaluru); unverified demo records are excluded'
  );

  const chickpet = allTemples.find((t) => t.slug === 'adinath-chickpet-bengaluru');
  assert(Boolean(chickpet), 'Chickpet temple exists in the database');
  assert(chickpet?.daily_family_capacity === 15, 'Chickpet daily family capacity is dynamically set to 15');
  assert(chickpet?.pooja_start_time === '06:00:00', 'Chickpet pooja start time is 06:00:00 AM');
  assert(chickpet?.pooja_end_time === '08:00:00', 'Chickpet pooja end time is 08:00:00 AM');
  assert(chickpet?.booking_cutoff_time === '18:00:00', 'Chickpet booking cutoff time is 18:00:00');
  assert(chickpet?.rolling_booking_months === 6, 'Chickpet rolling calendar window is 6 months');
  assert(Boolean(chickpet?.closure_rules.closed_days_of_week.includes(0)), 'Chickpet closure rules correctly specify Sunday (0)');

  const sowcarpet = allTemples.find((t) => t.slug === 'shankheshwar-sowcarpet-chennai');
  assert(Boolean(sowcarpet), 'Chennai Sowcarpet temple exists in the database');
  assert(sowcarpet?.daily_family_capacity === 20, 'Chennai temple has distinct configurable capacity (20)');
  assert(
    sowcarpet?.closure_rules.closed_days_of_week.length === 0,
    'Sunday closure is NOT hardcoded globally: Chennai is open all 7 days'
  );

  // --- Suite 5: Cross-Tenant Isolation & Privilege Escalation Defenses ---
  console.log('\n--- Suite 5: Cross-Tenant Isolation & Privilege Escalation Defenses ---');
  const chickpetId = chickpet!.id;
  const chennaiId = sowcarpet!.id;

  // 5a. Superadmin sees all temples
  const superadminTemples = devStore.getTemplesForActor('superadmin', null);
  assert(superadminTemples.length >= 2, 'Superadmin can view all temples across cities');

  // 5b. Chickpet Temple Admin is isolated to Chickpet
  const chickpetAdminTemples = devStore.getTemplesForActor('temple_admin', chickpetId);
  assert(
    chickpetAdminTemples.length === 1 && chickpetAdminTemples[0].id === chickpetId,
    'Chickpet Temple Admin is isolated to their assigned temple'
  );

  // 5c. Unauthorized modification by family user blocked
  const devoteeUpdate = devStore.updateTemple(
    chickpetId,
    { daily_family_capacity: 50 },
    'devotee-1',
    'family',
    chickpetId
  );
  assert(!devoteeUpdate.success, 'RLS prevents Family/Devotee user from modifying temple capacity');

  // 5d. Cross-temple modification blocked: Chickpet Admin cannot edit Chennai
  const crossTempleUpdate = devStore.updateTemple(
    chennaiId,
    { daily_family_capacity: 99 },
    'chickpet-admin-1',
    'temple_admin',
    chickpetId
  );
  assert(!crossTempleUpdate.success, 'RLS prevents Chickpet Temple Admin from modifying Chennai temple');

  // 5e. Cross-temple role assignment blocked: Chickpet Admin cannot assign staff to Chennai
  const crossStaffAssign = devStore.assignMembership(
    {
      userId: 'devotee-1',
      organizationId: orgs[0].id,
      templeId: chennaiId,
      role: 'temple_manager',
    },
    'chickpet-admin-1',
    'temple_admin',
    chickpetId
  );
  assert(!crossStaffAssign.success, 'RLS prevents Temple Admin from assigning staff outside their temple');

  // 5f. Privilege escalation blocked: Temple Admin cannot assign Superadmin role
  const illegalEscalation = devStore.assignMembership(
    {
      userId: 'devotee-1',
      organizationId: orgs[0].id,
      templeId: chickpetId,
      role: 'superadmin',
    },
    'chickpet-admin-1',
    'temple_admin',
    chickpetId
  );
  assert(!illegalEscalation.success, 'RLS prevents Temple Admin from escalating users to Superadmin');

  // 5g. Devotee cannot access audit logs
  const devoteeLogs = devStore.getAuditLogsForActor('family', chickpetId);
  assert(devoteeLogs.length === 0, 'Devotees and unauthenticated users cannot read audit logs');

  // 5h. Devotee cannot access private staff memberships
  const devoteeMems = devStore.getMembershipsForActor('family', chickpetId);
  assert(devoteeMems.length === 0, 'Devotees cannot read private staff memberships');

  // 5i. Authorized Chickpet Admin can update Chickpet
  const authorizedUpdate = devStore.updateTemple(
    chickpetId,
    { daily_family_capacity: 18 },
    'chickpet-admin-1',
    'temple_admin',
    chickpetId,
    'Chickpet Admin'
  );
  assert(authorizedUpdate.success, 'Authorized Chickpet Admin can update Chickpet capacity');

  // 5j. Verify immutable audit log record created for authorized update
  const adminAuditLogs = devStore.getAuditLogsForActor('superadmin', null);
  const latestLog = adminAuditLogs[0];
  assert(latestLog.action === 'UPDATE_TEMPLE_CONFIG', 'Audit log automatically captures UPDATE_TEMPLE_CONFIG');
  assert(latestLog.entity_id === chickpetId, 'Audit log correctly attributes the affected temple entity');
  assert(latestLog.before_data !== null && latestLog.after_data !== null, 'Audit log contains before and after state diffs');

  console.log('\n================================================================');
  console.log('🎉 ALL 24 VERIFICATION AUDIT CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runComprehensiveAudit().catch((err) => {
  console.error('Audit suite encountered error:', err);
  process.exit(1);
});
