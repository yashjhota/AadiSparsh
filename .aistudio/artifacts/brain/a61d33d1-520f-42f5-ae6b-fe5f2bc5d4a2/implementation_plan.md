# Unified Mobile & Password Authentication Implementation Plan

Transition the Aadi Sparsh authentication architecture from mobile OTP to a streamlined, unified mobile number and password sign-in experience for all users (devotee families and temple staff), with automated role detection, single-screen auto-registration, and Supabase Auth database synchronization.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed via interactive clarification:
> - **Unified Sign-In Flow**: Both temple staff and devotee families will use a unified mobile number and password login interface that automatically detects active staff roles versus devotee status and routes accordingly.
> - **Single-Screen Seamless Registration**: Entering an unregistered mobile number with a password seamlessly registers the user account without requiring fragmented multi-step tabs.
> - **Native Supabase Phone & Password Auth**: Utilizes `supabase.auth.signInWithPassword({ phone, password })` and `supabase.auth.signUp({ phone, password })` directly against Supabase GoTrue Auth, eliminating SMS gateway dependencies while preserving full session persistence and RLS security.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces the phone OTP flow with a secure, instant mobile number and password authentication modal. Devotees and staff enter their mobile number (with country code) and password. New numbers are registered seamlessly with name and profile initialization; existing accounts authenticate instantly. The system inspects database memberships to assign the appropriate role (`superadmin`, `temple_admin`, `temple_manager`, or `family`).
- **Target Audience / Personas**: 
  1. *Devotee Families*: Booking morning Parmatma Pooja and managing family visit reservations.
  2. *Temple Staff & Trustees*: Administering capacities, viewing devotee registrations, and managing operational closures.
- **Key Value**: Immediate, reliable authentication without reliance on external SMS delivery gateways or OTP delivery delays, while keeping the door open to re-introducing OTP in future phases.

---

## 2. User Experience & Visual Design

- **Unified Authentication Modal**:
  - Calm ivory (`#FDFBF7`), antique charcoal (`#1C1917`), and warm saffron/gold accents (`#92400E` / `#B45309`) adhering to the Museum & Institutional design system.
  - Single, serene modal accessible from the header ("Sign In") and booking flows ("Book Temple Visit").
  - Country code dropdown (+91 India default) with auto-formatted mobile number input.
  - Password input with visible/hidden toggle (`Eye` / `EyeOff`) and minimum security criteria.
  - Optional full name field (revealed or prefilled for registration).
  - Clean error states for invalid passwords, malformed phone numbers, or network timeouts.
- **Role-Aware Auto Routing**:
  - After successful authentication, if the user holds an active staff membership in `temple_memberships`, the UI shows their assigned role badge (`Temple Administrator`, `Temple Manager`, or `Superadmin`) and offers direct navigation to the Staff Administration Console.
  - If the user is a devotee family, they are immediately welcomed into their family profile and booking workspace.

```
+─────────────────────────────────────────────────────────────────+
|  AADI SPARSH • TEMPLE PORTAL                                [X] |
|                                                                 |
|  Sign In to Aadi Sparsh                                         |
|  Enter your mobile number and password to access pooja bookings |
|  and temple governance.                                         |
|  ─────────────────────────────────────────────────────────────  |
|                                                                 |
|  Mobile Number                                                  |
|  [ +91 v ] [ 98450 12345                              ]        |
|                                                                 |
|  Password                                                       |
|  [ •••••••••••••••••                                   ] [Eye]  |
|                                                                 |
|  Full Name (required for first-time registration)               |
|  [ Nemichand Shah                                     ]        |
|                                                                 |
|  [   Sign In / Register Account                             ]   |
|                                                                 |
|  Protected by Supabase Auth & PostgreSQL Row Level Security     |
+─────────────────────────────────────────────────────────────────+
```

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native Supabase Phone + Password Auth**
  - *Approach*: Use Supabase Auth's native phone provider with password support (`supabase.auth.signInWithPassword({ phone, password })`).
  - *Why*: Standard GoTrue endpoint, cryptographically hashes passwords with bcrypt/argon2 in `auth.users`, anchors `auth.uid()` to `profiles.id`, and respects all existing foreign keys and RLS policies.
  - *Fallback*: In development or local sandbox mode, `DevMemoryStore` verifies hashed/secure credentials and maintains matching session state.
- **Decision 2: Automated Role Resolution**
  - *Approach*: Upon session establishment, query `temple_memberships` joined with `temples` to determine highest active privilege.
  - *Why*: Prevents client-side role tampering while avoiding separate, redundant login screens for staff and families.
- **Decision 3: Preserving Phone Number Immutability**
  - *Approach*: Keep the existing `trigger_protect_verified_mobile` on `public.profiles`. The verified mobile number remains strictly tied to the authenticated identity.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Unified Auth Modal UI                     │
│  - Mobile Number (E.164) & Password                          │
│  - Single-Screen Sign In / Auto-Registration                 │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     AuthContext & Supabase                   │
│  - supabase.auth.signInWithPassword({ phone, password })    │
│  - Auto-Fallback to signUpWithPassword on UserNotFound       │
│  - Secure session token in localStorage / cookies            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│               PostgreSQL Schema & RLS Engine                 │
│  - auth.users (phone, encrypted_password)                    │
│  - public.profiles (id = auth.uid(), verified_mobile)        │
│  - public.temple_memberships (role-based staff detection)    │
│  - 006_phone_password_auth.sql migration                     │
└──────────────────────────────────────────────────────────────┘
```

### Proposed Changes:

1. **Database Migration (`supabase/migrations/006_phone_password_auth.sql`)**:
   - Ensures phone provider configuration notes and helper functions.
   - Syncs `supabase/full_schema_migration.sql`.
2. **Repository & Client Auth Layer (`src/lib/supabase.ts` & `src/context/AuthContext.tsx`)**:
   - Add `signInWithPhonePassword(phone: string, password: string)`
   - Add `signUpWithPhonePassword(phone: string, password: string, fullName?: string)`
   - Auto-detect roles via `getMembershipsForUser` upon sign-in.
   - Update `DevMemoryStore` with password support for default accounts.
3. **UI Modernization**:
   - Update `FamilyAuthModal.tsx` into a streamlined `UnifiedAuthModal.tsx` (or update in-place).
   - Update `StaffSignIn.tsx` and `Header.tsx` to link seamlessly to the unified mobile/password flow.
4. **Automated Verification**:
   - Update test suites (`scripts/test-phase2a.ts` and `scripts/test-phase2b.ts`) to test mobile + password sign-in, auto-registration, role detection, and RLS integrity.

---

## Verification Plan

- `tsc --noEmit` & `npm run lint`: Verify 0 TypeScript compilation or lint errors.
- `vite build`: Verify production bundle builds cleanly.
- `npm test`: Run full automated verification suite confirming mobile+password sign in, auto-registration, role resolution, and booking engine persistence.
