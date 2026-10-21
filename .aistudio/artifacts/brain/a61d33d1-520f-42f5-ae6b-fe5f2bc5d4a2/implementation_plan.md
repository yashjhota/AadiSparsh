# Aadi Sparsh — Phase 1: Foundation & Architecture

Technical foundation and multi-tenant architecture for **Aadi Sparsh**, a SaaS platform designed to reconnect Jain families with temples through visits and Parmatma Pooja registrations, starting with Shri Adinath Bhagwan Jain Temple in Chickpet, Bengaluru.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during the clarification interview:

- **Confirmed Runtime Architecture**: Vite + React 19 frontend with Node.js/Express backend service and `@supabase/supabase-js` client SDK.
- **Confirmed Connectivity Mode**: Real Supabase client connectivity with an integrated development fallback mode so the application runs, seeds, tests, and demonstrates multi-tenancy and RLS concepts immediately in AI Studio while supporting instant connection to any live Supabase project.
- **Confirmed Visual Direction**: Ivory marble (`#FDFBF7`), warm limestone (`#F4EFEA`), deep charcoal ink (`#1C1917`), and warm sacred saffron/gold accents (`#B45309`, `#D97706`), strictly adhering to anti-slop rules, zero-pill discipline, and calm Jain aesthetics.
- **Confirmed Auth & OTP Flow**: Standard Supabase Phone OTP auth foundation with a test verification utility for development environments without requiring active SMS credits.

---

## 1. Overview & Core Concept

- **What It Does**: Establishes the multi-tenant data model, security perimeter, and administrative management interface for temples across cities and organizations. Supports dynamic temple configurations (timings, daily capacities, closure days, rolling booking windows) without hardcoded business rules.
- **Target Audience / Personas**:
  - *Superadmin*: Platform administrators managing organizations, cities, temples, and assigning administrators.
  - *Temple Administrator*: Authorized staff managing specific temple operational settings and staff roles.
  - *Temple Manager*: Day-to-day temple operational supervisors with scoped permissions.
  - *Families / Devotees*: Public visitors exploring participating temples and preparing for mobile-verified Parmatma Pooja bookings.
- **Key Value**: A single codebase powering multi-city temple operations with strict tenant isolation, auditable configuration changes, and a rock-solid security foundation ready for Phase 2 booking transactions.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Public Discovery View**:
   - Serene institutional banner with sacred Jain iconography, platform mission statement, and multi-temple discovery.
   - Temple card showing Shri Adinath Bhagwan Temple (Chickpet, Bengaluru) populated from dynamic database settings (Pooja timings: 06:00–08:00, capacity: 15 families/day, Sunday closure rule), not hardcoded strings.
   - Quick selector to preview how additional cities (e.g., Chennai, Mumbai) and temples seamlessly appear under the same architecture.
2. **Staff & Administrator Sign-In**:
   - Clean mobile number OTP interface with clear status indications (Requesting OTP, Enter 6-digit Code, Verifying, Authenticated).
   - In dev mode, includes a quick test credential selector to experience different role perspectives (Superadmin, Chickpet Temple Admin, Temple Manager).
3. **Administrative Console**:
   - Sidebar workspace with breadcrumb navigation.
   - Active Views:
     - **Overview**: System metrics (organizations, active cities, temples, assigned staff, audit log volume).
     - **Organizations**: Organization listing, tenant health, and creation modal.
     - **Cities**: City management across states and timezones (Bengaluru, Chennai).
     - **Temples**: Comprehensive configuration inspector for Chickpet and other temples (Pooja start/end times, rolling booking window, daily capacity, booking cutoff time, registration toggles).
     - **Staff & Roles**: Membership assignment matrix with strict role hierarchy enforcement.
     - **Audit Logs**: Tamper-proof activity stream tracking who changed what (`actor_user_id`, `before_data`, `after_data`, `action`).
     - **Database & Migrations**: Live SQL schema inspector, migration status, and seed runner.

### Visual Identity & Theme
- **Aesthetic Direction**: Curatorial, serene, sacred, and respectful of Jain traditions. Alabaster, warm stone, and refined typography.
- **Color Palette**:
  - Neutral Canvas (60%): Warm Ivory (`#FDFBF7`), Pure Alabaster (`#FAF7F2`), Neutral Slate (`#F5F0E8`).
  - Structural Surfaces (30%): Stone card surfaces (`#FFFFFF`), hairline borders (`#E7E0D6`), muted text (`#78716C`), deep ink headers (`#1C1917`).
  - Accent Budget (10%): Warm Saffron (`#B45309`), Sacred Amber (`#D97706`), Deep Ochre (`#78350F`).
- **Typography & Anti-Slop Discipline**:
  - Display Font: High-contrast refined serif (`Cinzel` / `Playfair Display` or system serif fallback) for titles.
  - Body Prose: Clean, legible sans-serif (`Plus Jakarta Sans` or modern sans fallback).
  - Tabular Data: Monospace tabular numerals (`font-mono tabular-nums`) for timestamps, capacities, and timing slots.
  - Zero-Pill Rule: No capsule badges or pill islands; metadata displayed using clean unboxed text separated by typographic middots (`·`).
  - No fake AI jargon, no bottom telemetry tickers, no pulsing green dots.

---

## 3. Key Product Decisions & Trade-Offs

### 1. Dual-Mode Supabase Client (Real + Development Seed Fallback)
- *Chosen Approach*: Implement a unified Supabase client layer. If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided in environment variables, queries execute against live Supabase PostgreSQL. If unconfigured or offline, an in-memory transactional mock mirroring the exact PostgreSQL schema, RLS policies, and seed data serves the interface seamlessly.
- *Why*: Allows immediate evaluation, end-to-end testing, and demonstration in AI Studio without blocking on external credential setup, while retaining 100% production compatibility with Supabase.
- *Alternatives Considered*: Hard failure when credentials are blank (rejected because it breaks the preview experience).

### 2. Version-Controlled SQL Migrations & Strict RLS
- *Chosen Approach*: Store production SQL migrations in `/supabase/migrations/` (`001_initial_schema.sql`, `002_rls_policies.sql`, `003_seed_data.sql`).
- *Security*: RLS enabled on all 6 tables. Helper functions `auth.uid()`, `get_user_role()`, and membership checks enforce tenant isolation. Service-role keys are strictly forbidden in client-side code.

### 3. Server-Side Express API + Migration Helper
- *Chosen Approach*: Lightweight Express API running on port 3000 alongside Vite to handle server-side schema verification, migration viewing, and secure server-to-server operations.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Aadi Sparsh Web App                           │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │    Public Portal View     │      │     Admin Console View      │   │
│   │  - Temple Discovery       │      │  - Overview & Organizations │   │
│   │  - Configurable Details   │      │  - Cities & Temples Config  │   │
│   │  - Mobile OTP Sign-in     │      │  - Staff & Roles Hierarchy  │   │
│   │  - Future Booking Notice  │      │  - Tamper-proof Audit Logs  │   │
│   └─────────────┬─────────────┘      └──────────────┬──────────────┘   │
│                 │                                   │                  │
│                 └─────────────────┬─────────────────┘                  │
│                                   ▼                                    │
│                    ┌─────────────────────────────┐                     │
│                    │     Supabase Client SDK     │                     │
│                    │  - Real / Dev Fallback Hook │                     │
│                    │  - Auth & Role Context      │                     │
│                    └──────────────┬──────────────┘                     │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
    ┌───────────────────────────┐       ┌────────────────────────────┐
    │     Supabase Backend      │       │     Express Dev Server     │
    │  - PostgreSQL 15+         │       │  - Port 3000 API Proxy     │
    │  - Supabase Auth (SMS OTP)│       │  - Migration Status & Docs │
    │  - Row Level Security     │       │  - Dev Seed Scripts        │
    └───────────────────────────┘       └────────────────────────────┘
```

### Relational Schema & Tables
1. **`organizations`**: `id` (UUID), `name`, `slug` (unique), `status`, `created_at`, `updated_at`.
2. **`cities`**: `id` (UUID), `organization_id` (FK), `name`, `state`, `country`, `timezone`, `created_at`, `updated_at`.
3. **`temples`**: `id` (UUID), `organization_id` (FK), `city_id` (FK), `name`, `slug`, `address`, `timezone` (default `'Asia/Kolkata'`), `pooja_start_time` (`'06:00'`), `pooja_end_time` (`'08:00'`), `daily_family_capacity` (default 15), `registration_enabled` (boolean), `rolling_booking_months` (default 6), `booking_cutoff_time` (`'18:00'`), `status`, `created_at`, `updated_at`.
4. **`profiles`**: `id` (UUID FK to `auth.users`), `full_name`, `verified_mobile`, `locality`, `city`, `state`, `country`, `created_at`, `updated_at`.
5. **`temple_memberships`**: `id` (UUID), `user_id` (FK), `organization_id` (FK), `temple_id` (FK, nullable for org-level admins), `role` (`'superadmin' | 'temple_admin' | 'temple_manager' | 'family'`), `status`, `created_at`, `updated_at`. Unique constraint on `(user_id, organization_id, temple_id)`.
6. **`audit_logs`**: `id` (UUID), `actor_user_id` (FK), `organization_id` (FK), `temple_id` (FK, nullable), `entity_type`, `entity_id`, `action`, `before_data` (JSONB), `after_data` (JSONB), `created_at`. No direct update/delete policies for any user.

### Row Level Security (RLS) Policy Summary
- `temples`: Public read for active temples where `registration_enabled = true` (limited view); full manage for Superadmins and assigned Temple Admins.
- `organizations` & `cities`: Read for authenticated users; write restricted to Superadmin.
- `profiles`: Read/write restricted to the profile owner (`auth.uid() = id`), with read-only access for assigned temple admins/managers to verified contact data when authorized.
- `temple_memberships`: Read own membership; write only by Superadmins and Temple Admins (for their assigned temples).
- `audit_logs`: Insert allowed for server/service roles and logged user actions via database trigger; read restricted to Superadmin and Temple Admin for their own temple.

---

## 5. Verification & Acceptance Plan
1. **Compilation**: Run `compile_applet` to ensure error-free TypeScript and Vite build.
2. **Migration Files**: Ensure all SQL migrations exist in `/supabase/migrations/` and can be copied or executed directly in the Supabase SQL editor.
3. **Seed Scripts**: Verify development seed script generates Chickpet, Bengaluru as the first temple with configurable attributes.
4. **Multi-Tenancy Verification**: Ensure adding additional cities (Chennai) and temples works seamlessly in the UI.
5. **Phase 2 Boundary Guard**: Ensure booking and CRM features are clearly documented as coming in Phase 2, with no false mock booking mechanisms.
