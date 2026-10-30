# Comprehensive Technical Survey & Architectural Analysis: Hospital Follow-up Continuity System

- **Authoritative Specification Document:** `c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md` (1,189 lines)
- **Original User Request:** `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md`
- **Target Git Remote:** `https://github.com/arthur44558/dd`
- **Analysis Date:** 2026-10-30
- **Auditor:** Teamwork Explorer Survey Agent (`teamwork_explorer_survey_2`)

---

## 1. Executive Summary

The project requires building a full-stack, production-grade **Hospital Follow-up Continuity System** digitising doctor-completed follow-up forms, managing patient follow-up cycles, scheduling durable reminder tasks, coordinating hospital-wide follow-up pool activities, and enforcing strict clinical governance and append-only auditability.

Key mandate:
- **No clickable mockups or placeholder static arrays.** The application must be a functional, production-oriented modular monolith backed by Supabase PostgreSQL, Supabase Auth, and Supabase Storage.
- **Strict Role Separation:** 6 operational dashboards (`reception`, `assistant`, `doctor`, `department_head`, `coordinator`, `follow_up_head`) plus a separate privileged administrative console (`it_admin`).
- **Authorization & Data Isolation:** PostgreSQL Row Level Security (RLS) on 100% of exposed tables and Supabase Storage buckets, reinforced with server-side authorization in Next.js Server Actions and Route Handlers.
- **Handling of Open Decisions:** Exactly 16 open clinical and operational questions (OQ-01 through OQ-16) must be preserved in code via pluggable strategy interfaces or explicit `needs_configuration` states rather than silently guessing defaults.

---

## 2. Focus Area 1: Exact Technology Stack, Runtime Requirements & Tooling

### 2.1 Core Runtime & Frameworks
| Layer | Specification Requirement | Runtime / Version Details |
|---|---|---|
| **Runtime Environment** | Node.js | System Node is **v24.14.0**, npm **11.9.0** on Windows 11. |
| **Web Framework** | Next.js (App Router) | Latest Next.js (v14.x or v15.x) using App Router (`src/app/`), Server Components, Server Actions, and Route Handlers. |
| **Language** | TypeScript | Strict mode (`strict: true`, `noImplicitAny: true`) across server and client code. |
| **Styling & UI Components** | Tailwind CSS + shadcn/ui + Lucide | Utility-first styling with Tailwind CSS, accessible Radix-based primitives via shadcn/ui, icons via `lucide-react`. |
| **Form Handling & Validation** | Zod + React Hook Form | Strict schema validation with Zod (`zod`), connected via `@hookform/resolvers` to `react-hook-form`. |
| **Authentication & Identity** | Supabase Auth + `@supabase/ssr` | Cookie-based session management (`HttpOnly`, `Secure`, `SameSite`), MFA enforcement for `it_admin`. **Public self-signup disabled.** |
| **Persistence Engine** | Supabase PostgreSQL | Relational database with RLS, foreign keys, constraints, check expressions, transactions, and RPCs. |
| **File Storage** | Supabase Storage | Private storage buckets for uploaded original scanned doctor forms and evidence. |
| **Scheduling Engine** | Supabase Cron (`pg_cron`) + DB RPC | Scheduled job processor executing database functions with `FOR UPDATE SKIP LOCKED`. |
| **Deployment Target** | Vercel | Production and preview deployments with isolated environment variables. |
| **Testing Frameworks** | Vitest, Playwright, Supabase CLI / pgTAP | Unit tests (Vitest), End-to-end browser tests (Playwright), and database/RLS tests (`supabase test db`). |

### 2.2 Architectural Style: Modular Monolith
The specification strictly prohibits unnecessary microservices, external queue systems (e.g. BullMQ/RabbitMQ), Redis caches, or separate FastAPI backends (Spec lines 97–98). The database and Supabase services act as the authoritative transactional system of record.

---

## 3. Focus Area 2: Proposed Project Layout & Architecture

The specification (lines 137–198) defines a strict directory structure adhering to domain-driven modular monolithic architecture:

```text
c:\Users\ASUS\Desktop\Projects\dd\
├── .env.example                       # Documented environment variable template
├── .gitignore                         # Strict exclusion of .env*, node_modules, build artifacts
├── components.json                    # shadcn/ui configuration
├── next.config.ts / next.config.mjs   # Next.js build and header configurations (CSP, HSTS)
├── package.json                       # Scripts and project dependencies
├── tailwind.config.ts                 # Tailwind configuration with hospital color tokens
├── tsconfig.json                      # Strict TypeScript compiler options
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx               # Institutional landing page (login / request access actions)
│   │   │   └── layout.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx         # Supabase Auth email/password login
│   │   │   ├── request-access/
│   │   │   │   ├── page.tsx           # Public account request form
│   │   │   │   └── status/page.tsx    # Secure token-based request status lookup
│   │   │   ├── invite/accept/page.tsx # Invite verification & password setup
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── auth/callback/route.ts # Supabase OAuth / email token callback handler
│   │   ├── (workspace)/
│   │   │   ├── layout.tsx             # Authenticated shared shell with role-aware nav, top bar, notifications
│   │   │   ├── reception/page.tsx     # Dashboard 1: Patient registration, deduplication search, demographic corrections
│   │   │   ├── assistant/page.tsx     # Dashboard 2: Scanned form upload, manual intake, draft review, submission
│   │   │   ├── doctor/page.tsx        # Dashboard 3: Assigned patient follow-up review, correction requests
│   │   │   ├── department-head/page.tsx # Dashboard 4: Department approval queue (corrections, schedule modifications)
│   │   │   ├── coordinator/page.tsx   # Dashboard 5: "My Tasks" queue, manual simulated sends, call outcomes
│   │   │   ├── follow-up-head/page.tsx # Dashboard 6: Hospital-wide coordinator pool metrics, reassignment, priority override
│   │   │   └── it-admin/page.tsx      # Privileged IT Admin console: Account request queue, user lifecycle, audit review
│   │   ├── patients/[patientId]/page.tsx # Role-scoped patient detail view
│   │   ├── follow-ups/[followUpId]/page.tsx # Role-scoped follow-up detail & version history
│   │   ├── queries/[queryId]/page.tsx # Contextual inquiry threads (Coordinator <-> Assistant <-> Doctor)
│   │   ├── notifications/page.tsx     # Full notification center
│   │   ├── profile/page.tsx           # User settings, password change, MFA status
│   │   └── api/
│   │       ├── cron/process-reminders/route.ts # Protected cron fallback endpoint
│   │       └── ...
│   ├── components/
│   │   ├── app-shell/                 # Sidebar, header, user menu, breadcrumbs
│   │   ├── dashboard/                 # Metric tiles, workload breakdown
│   │   ├── forms/                     # Reusable form fields, dropzones, error summaries
│   │   ├── tables/                    # Paginated, filterable data tables
│   │   ├── approvals/                 # Before/After diff panels, approval actions
│   │   ├── notifications/             # Notification dropdown and item components
│   │   └── ui/                        # shadcn/ui primitives (button, dialog, badge, input, select, etc.)
│   ├── features/                      # Domain services and state logic (business logic isolation)
│   │   ├── auth/                      # Session verification, role determination
│   │   ├── access-requests/           # Request submission, IT approval, invite generation
│   │   ├── patients/                  # Registration, search RPC, contact verification
│   │   ├── follow-ups/                # Follow-up intake, cycle management, versioning
│   │   ├── documents/                 # Scanned file uploads, quarantine, signed URL generation
│   │   ├── corrections/               # Correction proposal creation, department head approval transaction
│   │   ├── schedules/                 # Reminder schedule generation strategies, overdue transitions
│   │   ├── communication/             # Manual simulated send confirmation, call attempt logging
│   │   ├── assignments/               # Coordinator load calculation, assignment strategies, priority override
│   │   ├── queries/                   # Linked inquiry threads, escalation chain
│   │   ├── notifications/             # In-app notification creation, read status
│   │   ├── audit/                     # Append-only audit logger
│   │   ├── administration/            # User status mutation, department memberships
│   │   └── ai-assistance/             # FormExtractionProvider adapter (behind feature flag)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser Supabase client (createBrowserClient)
│   │   │   ├── server.ts              # Server-side cookie-scoped client (createServerClient)
│   │   │   └── admin.ts               # Server-only admin client (SUPABASE_SECRET_KEY, import 'server-only')
│   │   ├── auth/
│   │   │   ├── require-user.ts        # Server-side actor authentication and profile status validation
│   │   │   └── permissions.ts         # Typed permission checkers supplementing RLS
│   │   ├── validation/                # Zod schemas for all domain entities and forms
│   │   ├── security/                  # Rate limiting, CAPTCHA verification, CSRF protection
│   │   ├── dates/                     # Timezone-aware date calculations (Asia/Kolkata default)
│   │   └── errors/                    # Standardized error definitions and safe error messaging
│   └── types/
│       ├── database.types.ts          # Generated Supabase database schema types
│       └── domain.ts                  # Domain models, enum definitions, view models
└── supabase/
    ├── config.toml                    # Local Supabase project configuration
    ├── seed.sql                       # Synthetic demonstration data & role profile mapping
    ├── migrations/                    # Versioned, reproducible SQL migrations
    └── tests/
        ├── rls/                       # pgTAP / SQL tests for row-level security
        ├── database/                  # Constraints, functions, and trigger tests
        └── fixtures/                  # Synthetic test data sets
```

---

## 4. Focus Area 3: Dependencies, Libraries, Build Tools & Environment Variables

### 4.1 Dependency Manifest

#### Production Dependencies (`dependencies`):
- `next`: `^14.2.0` or `^15.0.0`
- `react`, `react-dom`: `^18.3.0` or `^19.0.0`
- `@supabase/supabase-js`: `^2.49.0`
- `@supabase/ssr`: `^0.5.0`
- `zod`: `^3.24.0`
- `react-hook-form`: `^7.54.0`
- `@hookform/resolvers`: `^3.10.0`
- `lucide-react`: `^0.475.0`
- `clsx`: `^2.1.1`
- `tailwind-merge`: `^3.0.0`
- `class-variance-authority`: `^0.7.1`
- `date-fns`: `^4.1.0`
- `date-fns-tz`: `^3.2.0`
- `server-only`: `^0.0.1`

#### Development Dependencies (`devDependencies`):
- `typescript`: `^5.7.0`
- `@types/node`: `^22.0.0`
- `@types/react`: `^18.3.0` / `^19.0.0`
- `@types/react-dom`: `^18.3.0` / `^19.0.0`
- `tailwindcss`: `^3.4.0` or `^4.0.0`
- `postcss`: `^8.5.0`
- `autoprefixer`: `^10.4.0`
- `eslint`: `^9.0.0` or `^8.57.0`
- `eslint-config-next`: `^14.0.0` / `^15.0.0`
- `vitest`: `^3.0.0`
- `@testing-library/react`: `^16.0.0`
- `@playwright/test`: `^1.50.0`
- `supabase`: `^2.122.0` (accessible via `npx supabase`)

### 4.2 Environment Variables (Spec Section 12)

`.env.example` must contain:
```dotenv
# Public Supabase Client (Browser safe)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=

# Server-only Credentials (NEVER expose to browser)
SUPABASE_SECRET_KEY=
SUPABASE_DB_URL=
APP_TIME_ZONE=Asia/Kolkata
ACCOUNT_REQUEST_RATE_LIMIT_KEY=
CAPTCHA_SECRET_KEY=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=
CRON_SECRET=

# AI & Adaption Labs Adapter (Optional / Disabled by default)
ADAPTION_LABS_API_KEY=
ADAPTION_LABS_BASE_URL=
ADAPTION_LABS_MODEL_ID=
AI_FORM_EXTRACTION_ENABLED=false
```

Security Rules for Environment Variables:
1. `NEXT_PUBLIC_*` is strictly confined to browser-safe parameters.
2. `SUPABASE_SECRET_KEY` (service role) is used **only** by `src/lib/supabase/admin.ts` for IT admin actions (inviting users, updating Auth bans). It must never be imported in normal user request flows to prevent bypassing RLS.
3. `.env*.local` must be added to `.gitignore`.

---

## 5. Focus Area 4: Entry Points, Operational Commands, Background Workers & Daemons

### 5.1 CLI Commands & Scripts (`package.json`)
- `npm run dev`: Launch local Next.js development server at `http://localhost:3000`.
- `npm run build`: Compile TypeScript and Next.js production build (`next build`).
- `npm start`: Start production server on Vercel or Node runtime.
- `npm run lint`: Run ESLint across `src/` to ensure code compliance.
- `npm run type-check`: Execute `tsc --noEmit` to verify type safety.
- `npm run test`: Run unit and integration tests using `vitest run`.
- `npm run test:e2e`: Run Playwright browser suites across user roles.
- `npm run db:types`: Execute `npx supabase gen types typescript` to sync `src/types/database.types.ts`.
- `npm run db:lint`: Check SQL migrations and policies.

### 5.2 Server Entry Points & Route Types
1. **Public Web Entry Points:**
   - `GET /`: Landing page with Hospital identity, Login, and Account Request links.
   - `GET /login`, `POST /login` (Server Action): Supabase Auth authentication.
   - `GET /request-access`, `POST /request-access` (Server Action): Public account request submission.
   - `GET /request-access/status`: Anti-enumeration status check using secret lookup token hash.
   - `GET /invite/accept`: User invite onboarding and initial password creation.
2. **Operational Role Workspaces (Server-Guarded):**
   - `GET /reception`: Reception dashboard (restricted to `role = 'reception'`).
   - `GET /assistant`: Doctor's Assistant dashboard (`role = 'assistant'`).
   - `GET /doctor`: Doctor clinical oversight dashboard (`role = 'doctor'`).
   - `GET /department-head`: Department Head approval console (`role = 'department_head'`).
   - `GET /coordinator`: Follow-up Coordinator tasks workspace (`role = 'coordinator'`).
   - `GET /follow-up-head`: Follow-up Head hospital-wide pool manager (`role = 'follow_up_head'`).
   - `GET /it-admin`: Privileged IT Admin management console (`role = 'it_admin'`).
3. **API & Background Worker Entry Points:**
   - `POST /api/cron/process-reminders`: Protected endpoint triggered by cron scheduler; requires `Authorization: Bearer <CRON_SECRET>`. Runs due reminder queries and state machine transitions.
   - `GET /auth/callback`: Next.js Route Handler exchanging Auth exchange tokens and setting server cookies.

### 5.3 Background Daemons & Workers
- **Supabase Cron (`pg_cron`):**
  - Configured in Supabase database to invoke PostgreSQL procedure `process_due_reminder_jobs()` every minute.
  - Queries `reminder_jobs` where `status = 'pending'` AND `scheduled_for <= NOW()` using `FOR UPDATE SKIP LOCKED`.
  - Emits `communication_tasks` for coordinators.
  - Handles overdue transition: when `follow_ups.appointment_date < CURRENT_DATE` and follow-up is not completed, transitions status to `OVERDUE` and generates overdue tasks at +2 and +4 calendar days in hospital timezone.
  - Enforces retry cap (maximum 3 attempts).

---

## 6. Focus Area 5: External Integrations, Mock Interfaces, Persistence & Migrations

### 6.1 Database Persistence Architecture (27 Required Tables)
The PostgreSQL schema must enforce strict relational modeling across 27 domain entities:
1. `profiles`: Maps directly to Supabase `auth.users(id)` via UUID foreign key. Fields: display name, role (`reception`, `assistant`, `doctor`, `department_head`, `coordinator`, `follow_up_head`, `it_admin`), status (`invited`, `active`, `suspended`, `deactivated`), permanent identity.
2. `account_requests`: Pending/approved/rejected requests from prospective staff; stores hashed status token.
3. `account_request_events`: Append-only event log for request review, approvals, rejections.
4. `departments`: Clinical and operational hospital departments.
5. `department_memberships`: Mapping user UUID to department ID, active status flag.
6. `doctor_profiles`: Stable clinical doctor identifier (`doctor_id`), license metadata, mapped user UUID.
7. `patients`: Immutable system-generated `patient_id`, full name, DOB, gender, active flag.
8. `patient_contacts`: Normalised phone/email, verification status, `shared_contact_flag`, emergency flag.
9. `patient_profile_versions`: Historic snapshots of demographic changes with approver attribution.
10. `consultations`: Consultation metadata linking patient and doctor.
11. `follow_ups`: Main follow-up cycle record, linking patient, doctor, department, assistant, lifecycle state (`DRAFT`, `SUBMITTED`, `ACTIVE`, `OVERDUE`, `COMPLETED`).
12. `follow_up_versions`: Immutable submitted snapshots, clinical notes, severity (`Normal`, `Moderate`, `Severe`), appointment date, source document pointer.
13. `source_documents`: Private storage object key, SHA-256 hash, MIME type, byte size, uploader UUID.
14. `correction_requests`: Formal proposal to alter submitted follow-up data or schedule; tracks `base_version`.
15. `correction_request_items`: Field-level diff (field name, old value, proposed value, conflict flag).
16. `approval_decisions`: Department Head decision log (approved/rejected, reason, timestamp).
17. `schedule_configs`: Versioned parameters for reminder spacing strategy and severity ratios.
18. `reminder_schedules`: Follow-up reminder cycle schedule version, status (`active`, `superseded`, `cancelled`).
19. `reminder_jobs`: Durable queue records for execution; tracks idempotency key, scheduled time, retries.
20. `communication_tasks`: Tasks surfaced on coordinator's "My Tasks" queue.
21. `communication_attempts`: Append-only record of coordinator actions (`MANUALLY_CONFIRMED_SIMULATED_SEND`, call outcomes).
22. `follow_up_outcomes`: Final cycle resolution (attended, missed, cancelled, new cycle needed).
23. `coordinator_assignments`: Historical assignment records of coordinators to follow-up cases.
24. `coordinator_workload_events`: Real-time workload state change tracking for pool analytics.
25. `internal_queries`: In-app query threads linked to specific follow-up cases.
26. `query_messages`: Individual messages within query threads with escalation tracking.
27. `notifications`: In-app notification items with target URLs and read state.
28. `audit_events`: Tamper-evident, append-only log of all critical system actions.
29. `ai_assistance_events`: Audit log for OCR/AI draft suggestions, confidence scores, and human modifications.

### 6.2 External Integrations & Strategy Interfaces

| Integration / Subsystem | Current Release Scope | Strategy / Abstraction Pattern |
|---|---|---|
| **Patient Messaging (SMS/WhatsApp/Voice)** | **Simulated / Manual Only.** No actual telecom providers connected in Release 1. | Actions record `MANUALLY_CONFIRMED_SIMULATED_SEND`. UI clearly displays "Manually confirmed / simulated — not provider verified". |
| **Reminder Schedule Strategy** | Open decision (OQ-04/05/06). Spacing formula awaiting clinical approval. | `ReminderScheduleStrategy` interface. Feature is set to `needs_configuration` state with an explicit admin notice until approved. Overdue +2/+4 days logic is active. |
| **Coordinator Assignment Strategy** | Open decision (OQ-08). Workload algorithm awaiting operational signoff. | `AssignmentStrategy` interface. System supports explicit manual assignment and fallback unassigned queue with `needs_configuration` warning for auto-weights. |
| **AI Form Extraction** | Optional assistance via Adaption Labs or OCR provider. Human review mandatory. | `FormExtractionProvider` TypeScript interface behind `AI_FORM_EXTRACTION_ENABLED=false` flag. Extracted fields populate editable draft; AI cannot approve or submit. |
| **Supabase Storage** | Private bucket for scanned forms and correction evidence. | Storage client generating short-lived signed URLs (15-min expiry) after verifying RLS permissions. Direct public bucket URLs are strictly forbidden. |

### 6.3 Migration & Database Tooling Requirements
- Migrations stored in `supabase/migrations/<timestamp>_<name>.sql`.
- Must execute cleanly from scratch (`supabase db reset` or sequential execution).
- Every migration must include:
  1. Table definition with constraints and primary keys.
  2. RLS enable statement: `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`.
  3. Explicit granular policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE` per authenticated role and anon.
  4. Automatic updated_at triggers and audit logging triggers.
- `supabase/seed.sql`: Contains synthetic test patients, departments, and idempotent profile mappings for the 6 demonstration roles and IT Admin.

---

## 7. Focus Area 6: Git Repository & GitHub Remote Requirements

### 7.1 Current Repository Status
- Current workspace directory: `c:\Users\ASUS\Desktop\Projects\dd\`
- Git status: **Not yet initialized** (`fatal: not a git repository`).
- Target Remote: `https://github.com/arthur44558/dd`
- Git credentials: Local Windows credential manager is configured with user Divyansh (`chaudharydivyansh567@gmail.com`).

### 7.2 Git Setup & Branching Procedure
1. Initialize repository: `git init -b main`.
2. Configure remote: `git remote add origin https://github.com/arthur44558/dd`.
3. Set `.gitignore` to protect all environment files, secrets, build caches, and node_modules:
   ```gitignore
   node_modules/
   .next/
   out/
   .env*.local
   .env.production
   .env.development
   .env
   npm-debug.log*
   yarn-debug.log*
   yarn-error.log*
   .turbo
   .agents/teamwork/
   ```
4. Commit Conventions:
   - Use Conventional Commits with clear vertical slices:
     - `feat(auth): initialize Supabase Auth, profiles, and account-request workflow`
     - `feat(db): add 27 domain tables with strict RLS policies and audit triggers`
     - `feat(ui): implement shared authenticated shell and 6 role-specific dashboards`
     - `feat(intake): implement scanned form upload, manual draft review, and submission`
     - `feat(approvals): implement correction proposal, diff review, and department head approval`
     - `feat(scheduler): implement durable reminder jobs and overdue task transitions`
     - `test: add unit, RLS, and end-to-end integration tests`
5. Remote Push:
   - Branch `main` pushed to `origin/main` using `git push -u origin main`.

---

## 8. Critical Architectural Guardrails & 16 Open Decisions

### 8.1 Non-Negotiable Guardrails (Spec Section 0 & 1.3)
1. **Human Accountability:** No clinical instruction, severity, diagnosis, treatment, or follow-up decision may be autonomously approved or invented by AI.
2. **Deny-by-Default Authorization:** Frontend route guards are cosmetic only; database RLS and server-side domain functions must block unauthorized operations.
3. **No Direct Mutation of Submitted Records:** Once submitted by an Assistant, a clinical follow-up record is immutable. Any modification requires a formal `correction_request` approved by a Department Head, generating a new `follow_up_version`.
4. **Permanent Attribution:** Suspending or deactivating a user must never delete their profile, audit trail, or historical records.
5. **Truthful Communications:** Manual confirmation in the coordinator UI must be explicitly stored and displayed as `Manually confirmed / simulated — not provider verified`.

### 8.2 Summary of 16 Open Operational Decisions (Section 16)
The specification mandates that none of the following open questions be silently decided:

| ID | Open Decision Subject | Technical Handling Required in Implementation |
|---|---|---|
| **OQ-01** | Multi-department clinical memberships | Model schema as `department_memberships`, but default application logic to 1 active department per user unless explicitly enabled by IT Admin. |
| **OQ-02** | Reassignment when original Assistant is unavailable | Expose an unassigned/reassignment queue for Department Head review rather than auto-routing to random assistants. |
| **OQ-03** | Demographic correction review routing | Route patient corrections to Department Head of the patient's primary or latest consultation department, with fallback to an institutional pool. |
| **OQ-04** | Reminder spacing mathematical formula | Encapsulate in `ReminderScheduleStrategy`; keep pre-appointment generation marked as `needs_configuration` in UI/admin. |
| **OQ-05** | Severity-based text/call ratios | Configurable in `schedule_configs` table; marked unconfigured until clinical review. |
| **OQ-06** | Permitted daytime window & timezone rules | Default configuration parameter `APP_TIME_ZONE=Asia/Kolkata`, with daytime window check (e.g. 09:00 - 18:00) flagged for owner signoff. |
| **OQ-07** | Follow-up cancellation / reopen authority | Do not expose cancellation or reopen buttons to general users; mark feature awaiting policy. |
| **OQ-08** | Coordinator load balancing weights & tie-breaks | Encapsulate in `AssignmentStrategy`; provide manual assignment and show `needs_configuration` for automated distribution. |
| **OQ-09** | Exact retry delays and escalation timeout | Cap total attempts at 3; expose retry interval as configurable setting. |
| **OQ-10** | Patient contact consent & preferences | Capture contact verification status and shared contact warning; do not assume verified number equals consent to disclose PHI. |
| **OQ-11** | Notification retention policy | Persist notifications with read/unread flags and timestamps; do not auto-delete without approved retention policy. |
| **OQ-12** | Detailed session & invite password policy | Enforce standard Supabase secure invite links and MFA for IT Admin. |
| **OQ-13** | IT Admin clinical emergency intervention | IT Admin has no routine access to clinical records. Emergency intervention requires time-bound, audited Department Head authorization. |
| **OQ-14** | Final paper form physical layout | Provide flexible form field mapping supporting standard follow-up fields (patient, doctor, date, severity, notes). |
| **OQ-15** | Data retention & deletion schedules | Retain all records and audit events immutably in Release 1; no automated hard deletion. |
| **OQ-16** | Production data region & backup targets | Document environment variables for Supabase regional project URL and Vercel hosting. |

---

## 9. Implementation Feasibility & Local Environment Observations

1. **System & Platform:**
   - OS: Windows 11 (PowerShell environment).
   - Node: v24.14.0 (compatible with Next.js 14 and 15).
   - npm: 11.9.0.
   - git: 2.55.0.windows.3.
2. **Tooling Nuance (Docker Absence):**
   - `docker` is not installed on the host machine.
   - Consequence: Running local Supabase containers via `supabase start` is not possible without Docker.
   - Strategy: The project should be structured with standard SQL migration scripts (`supabase/migrations/`) and configured to link to a cloud Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`) or run SQL migrations directly via PostgreSQL connection or Supabase Management API. For automated CI/CD and unit tests, database interactions can be tested against a dedicated Supabase development instance or mock schemas.
3. **Execution Readiness:**
   - The workspace contains only `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` and `.agents/`.
   - The project is fully ready for Phase 0 initialization following the exact vertical slice sequence outlined in Section 13.
