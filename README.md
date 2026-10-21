# Aadi Sparsh — Phase 1: Foundation & Architecture

A multi-tenant SaaS platform designed to reconnect Jain families with temples through temple visits and Parmatma Pooja bookings. The initial participating temple is **Shri Adinath Bhagwan Jain Temple in Chickpet, Bengaluru**, with full multi-city architectural support (including Chennai and beyond) within a single codebase.

---

## 1. Multi-Tenant Architecture

Aadi Sparsh enforces a 4-tier hierarchical multi-tenant structure:

```
Organization (Trust Federation / Mahasangh)
  └── City (Bengaluru, Chennai, etc. with local timezones)
        └── Temple (Shri Adinath Bhagwan Temple, Chickpet)
              ├── Temple Staff (Admins, Managers)
              └── Families / Devotees
```

- **Configurable per Temple**: Daily capacity (15 families default for Chickpet), Pooja timings (06:00–08:00 AM for Chickpet), sanctuary closure rules (Sundays closed for Snatra/maintenance for Chickpet), rolling calendar months (6), and booking cutoff times (18:00 previous day) are stored as relational data in PostgreSQL. **No temple operational rules are hardcoded in application logic.**
- **Tenant Isolation**: Row Level Security (RLS) policies isolate each temple's operational data and devotee records.

---

## 2. Technology Stack

- **Frontend**: React 19 SPA with TypeScript and Vite.
- **Styling**: Tailwind CSS v4 with anti-slop typography discipline (Cinzel display serif, Plus Jakarta Sans body, tabular numerals).
- **Backend & Database**: Supabase PostgreSQL with version-controlled SQL migrations.
- **Authentication**: Supabase Auth configured for mobile number OTP verification (`+91 ...`), with a safe development persona test harness.
- **Server**: Node.js & Express (`server.ts`) mounting Vite middleware on port 3000 in development, providing `/api/health` and `/api/migrations`.

---

## 3. Directory Structure

```
├── .env.example                     # Environment variable placeholders
├── index.html                       # HTML entry point with synchronized SEO meta
├── metadata.json                    # AI Studio metadata
├── package.json                     # Dependencies and npm scripts
├── server.ts                        # Express backend server (port 3000)
├── scripts/
│   ├── seed.ts                      # Development seed runner
│   └── test-foundation.ts           # RLS & multi-tenant test suite
├── src/
│   ├── App.tsx                      # Root application layout
│   ├── main.tsx                     # React DOM entry point
│   ├── index.css                    # Global Tailwind CSS and sacred theme tokens
│   ├── context/
│   │   └── AuthContext.tsx          # Supabase Auth, phone OTP, and persona switcher
│   ├── lib/
│   │   ├── supabase.ts              # Unified Supabase client & RLS repository layer
│   │   └── devData.ts               # Seed entities & test personas matching SQL migrations
│   ├── types/
│   │   └── database.ts              # TypeScript interfaces for all 6 database tables
│   └── components/
│       ├── Header.tsx               # Top Bar Contract compliant header
│       ├── PublicLanding.tsx        # Serene Jain temple presentation & city filter
│       ├── StaffSignIn.tsx          # Mobile OTP authentication interface
│       └── AdminConsole.tsx         # Multi-tenant admin workspace
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql   # Relational schema (6 tables, triggers, indexes)
        ├── 002_rls_policies.sql     # PostgreSQL Row Level Security & definer functions
        └── 003_seed_data.sql        # Seed script for Chickpet, Chennai, and audit logs
```

---

## 4. Database Schema & Tables

| Table | Purpose | Primary Keys & Key Foreign Keys |
| :--- | :--- | :--- |
| `organizations` | Trust Federations | `id` (UUID), `slug` (unique) |
| `cities` | Regional groupings | `id` (UUID), `organization_id` (FK) |
| `temples` | Participating temples | `id` (UUID), `city_id` (FK), `organization_id` (FK) |
| `profiles` | Devotee & staff profiles | `id` (UUID, references `auth.users(id)`) |
| `temple_memberships` | Role assignments | `id` (UUID), `user_id` (FK), `temple_id` (FK, nullable) |
| `audit_logs` | Tamper-proof history | `id` (UUID), `actor_user_id` (FK), `temple_id` (FK) |

---

## 5. Security & Row Level Security (RLS) Policies

1. **`temples`**:
   - `SELECT`: Publicly readable only when `status = 'active'` AND `registration_enabled = TRUE`.
   - `UPDATE`: Restricted to Superadmin or Temple Admin assigned specifically to that temple.
   - `INSERT`/`DELETE`: Restricted to Superadmin.
2. **`organizations` & `cities`**:
   - `SELECT`: Public for active directories.
   - `INSERT`/`UPDATE`/`DELETE`: Strictly restricted to Superadmin.
3. **`profiles`**:
   - `SELECT`: Profile owner (`id = auth.uid()`) or authorized staff.
   - `UPDATE`: Profile owner only.
4. **`temple_memberships`**:
   - `SELECT`: Own membership or scoped Temple Admin.
   - `INSERT`/`UPDATE`: Superadmin (all roles) or Temple Admin (managers/families only; cannot elevate to Superadmin).
5. **`audit_logs`**:
   - `SELECT`: Superadmin (org-wide) or Temple Admin (scoped to their temple).
   - `UPDATE`/`DELETE`: **Strictly denied for all users** (immutable records).
6. **Key Protection**: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side backend operations and never bundled into frontend client code.

---

## 6. Setup & Supabase Connection Instructions

### Step 1: Clone and Install
```bash
git clone <repo-url>
cd aadi-sparsh
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your credentials:
```env
VITE_SUPABASE_URL="https://<your-project-id>.supabase.co"
VITE_SUPABASE_ANON_KEY="<your-supabase-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-supabase-service-role-key>"
PORT=3000
```
*(Note: If left empty, Aadi Sparsh seamlessly runs in Development Fallback Mode with identical schemas and seed data).*

### Step 3: Apply Database Migrations
In your Supabase project dashboard:
1. Open the **SQL Editor**.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Run `supabase/migrations/002_rls_policies.sql`.
4. Run `supabase/migrations/003_seed_data.sql`.

Alternatively, use the Supabase CLI:
```bash
supabase db push
```

### Step 4: Safely Creating a Superadmin
To designate an authorized Superadmin without exposing public elevation endpoints:
1. Authenticate the user via phone OTP in Supabase Auth to generate their `auth.users` row and matching `profiles` record.
2. In the Supabase SQL Editor, execute:
```sql
INSERT INTO temple_memberships (user_id, organization_id, temple_id, role, status)
VALUES (
    '<user-uuid-from-profiles>',
    (SELECT id FROM organizations WHERE slug = 'jain-trust-federation'),
    NULL, -- NULL denotes organization-level authority across all temples
    'superadmin',
    'active'
);
```

### Step 5: Start Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000`.

---

## 7. Running Tests & Verifications

Run the automated foundation test suite verifying multi-tenancy, dynamic configuration, RLS rules, and elevation defenses:
```bash
npm test
```

Run TypeScript linting:
```bash
npm run lint
```

Run seed verification:
```bash
npm run seed
```

---

## 8. Scope Boundary: Phase 1 vs. Phase 2

### Implemented in Phase 1 (Foundation):
- Multi-tenant data model and schema across Organizations, Cities, Temples, and Staff.
- Idempotent SQL migrations with RLS policies and indexes.
- Dynamic temple configuration for Chickpet, Bengaluru and Sowcarpet, Chennai.
- Supabase Auth phone OTP foundation with development test personas.
- Protected administrative console for managing temples, cities, staff roles, and audit trails.
- Cross-tenant RLS defense mechanisms preventing unauthorized modifications.

### Reserved for Phase 2 (Pooja Booking Engine):
- Public devotee booking calendar (6 rolling months).
- 18:00 preceding-day cutoff enforcement and slot locking.
- PostgreSQL row-level locks / serializable transactions for concurrent overbooking prevention.
- Unique registration voucher generation (`AS-CHICKPET-2026-XXXX`).
- SMS and WhatsApp confirmation integration.
- Gatekeeper attendance desk and operational headcount reporting.
