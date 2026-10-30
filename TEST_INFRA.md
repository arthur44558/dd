# Test Infrastructure & Verification Architecture

## 1. Test Philosophy & Core Principles

The Hospital Follow-Up Continuity System is a high-assurance, clinical-grade healthcare web application built on **Next.js 15 (App Router, TypeScript Strict)**, **Supabase PostgreSQL (RLS, RPCs, pg_cron)**, **Supabase Auth**, **Supabase Storage**, and **Vercel**.

To guarantee clinical safety, regulatory compliance, and architectural integrity, the test infrastructure adheres to six non-negotiable principles:

1. **Opaque-Box & Requirement-Driven:**
   Tests verify observable external contracts, API responses, database row mutations, RLS permission boundaries, and browser interactions based strictly on `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` and `PROJECT.md`. Tests do not rely on or couple to internal private implementation details or ephemeral React component state.

2. **Dual-Layer Authorization Verification:**
   Authorization is enforced in two distinct layers:
   - **Database Layer:** PostgreSQL Row Level Security (RLS) default-deny policies on every table.
   - **Application Layer:** Server Actions and Route Handlers verifying authenticated user sessions and active role status.
   Tests verify both layers independently: database tests assert that unauthorized SQL queries fail even if client code is bypassed, and browser/API tests assert that front-end route guards and UI controls correctly reject unauthorized actions.

3. **Zero Fake Mocks in Integration & E2E:**
   No mock-ups, static in-memory arrays, or placeholder responses are permitted in end-to-end tests. All test workflows must validate real, database-backed state transitions, real foreign key relationships, and real audit event rows.

4. **Defensive Handling of Open Decisions (OQ-01 through OQ-16):**
   Where business rules are marked `OPEN` in the build spec (such as reminder cadence formulas, multi-department memberships, or cancellation policies), tests explicitly assert that the system remains in a safe `needs_configuration` or disabled state. Tests fail if an unapproved hardcoded heuristic is silently introduced.

5. **Strict Healthcare Privacy & Confidentiality (HIPAA/GDPR):**
   Tests programmatically enforce minimal data disclosure:
   - Reception staff cannot query or view clinical fields (severity, notes, diagnoses).
   - Follow-up Coordinators see clinical details only for specifically assigned cases, with mandatory shared-phone warnings.
   - IT Administrators have zero access to patient or clinical records.
   - Follow-up Head dashboards display aggregate throughput metrics without exposing identifiable clinical notes.

6. **Truthful Simulated Communications:**
   Because real external telephony/SMS gateways are excluded from this release, tests verify that all outbound tasks record and display the truthful disclaimer: `"Manually confirmed / simulated — not provider verified"`.

---

## 2. Complete Feature Inventory Coverage (Features 1 through 27)

Every feature defined in `PROJECT.md` is mapped to an authoritative verification strategy:

| # | Feature | Subsystem / Scope | Primary Test Target | Test Technique |
|---|---------|-------------------|----------------------|----------------|
| **1** | Project Scaffolding & Git Remote | Infrastructure & Build | Next.js 15, TypeScript strict, Tailwind v4, Git remote | Build check, lint, typecheck |
| **2** | Supabase Multi-Client Setup | Auth & DB Clients | Browser client, SSR Server client, Admin Service-Role client | Unit & Integration tests |
| **3** | Public Access Request Workflow | Public Auth (`/request-access`) | Form validation, rate limiting, SHA-256 tokens, pending status | Playwright E2E & Vitest API |
| **4** | IT Admin Account Management | Admin Console (`/it-admin`) | Review queue, Auth admin invite, account deactivation/reactivation | Playwright E2E & RLS |
| **5** | Role-Based Authenticated Shell | Navigation & Layout | Role banner, user avatar, Asia/Kolkata timezone indicator, logout | Playwright E2E |
| **6** | 6 Operational Dashboard Skeletons | Dashboards (Reception to FU Head) | 6 role dashboard pages, real metrics, role-scoped queries | Playwright E2E |
| **7** | Patient Registration & Contact Mgmt | Reception (`/reception`) | Patient registration, multi-phone contact support, preferred contact | Playwright E2E & DB |
| **8** | Patient Deduplication Search RPC | Reception / Assistant | RPC fuzzy & exact match by phone, name, MRN, ambiguous warnings | Vitest RPC & Playwright |
| **9** | Assistant Clinical Intake & Scan Upload | Assistant (`/assistant`) | Form digitisation, visit type, doctor lookup, private scan upload | Playwright E2E & Storage |
| **10** | Doctor Review & Submission | Doctor (`/doctor`) | Intake verification, clinical confirmation, final submission | Playwright E2E & DB |
| **11** | Submitted Record Immutability | Approvals / Governance | RLS locking direct UPDATE on submitted follow-up records | Vitest RLS & Playwright |
| **12** | Correction Request & Version Governance | Approvals (`/doctor`, `/assistant`) | Correction proposal creation, items breakdown, change reason | Playwright E2E & DB |
| **13** | Department Head Approval Workspace | Dept Head (`/department-head`) | Side-by-side diff view, atomic approval transaction (`FOR UPDATE`) | Playwright E2E & DB |
| **14** | Stale Proposal Handling | Approvals Governance | Automated invalidation/flagging of competing proposals on version bump | Vitest & Playwright E2E |
| **15** | Pluggable Reminder Schedule Strategy | Reminders (`src/features/reminders`)| `ReminderScheduleStrategy` interface defaulting to `needs_configuration`| Vitest Unit & Contract |
| **16** | Confirmed Overdue Engine | Reminders & Background Jobs | +2 and +4 calendar days overdue text tasks generated in `Asia/Kolkata` | Vitest Unit & Integration |
| **17** | Reliable Reminder Queue & Cron Worker | Queue (`/api/cron/process-reminders`)| `reminder_jobs`, `FOR UPDATE SKIP LOCKED`, max 3 retries, idempotency | Vitest Integration & DB |
| **18** | Coordinator Task Queue & Simulated Sends | Coordinator (`/coordinator`) | "My Tasks" queue, manual confirmation action with mandatory disclaimer | Playwright E2E |
| **19** | Follow-up Outcome Recording | Coordinator / Clinical | Patient contact resolution, reschedule, refusal, lost to follow-up | Playwright E2E & DB |
| **20** | Contextual Clinical Inquiries | Inquiries (`/queries`) | Thread Coordinator -> Assistant -> Doctor anchored to follow-up record | Playwright E2E |
| **21** | Notification Center | Shared UI (`/notifications`) | Real-time / polling alerts for approvals, overdue tasks, inquiries | Playwright E2E |
| **22** | Immutable Audit Logging | Audit (`audit_events`) | Triggers and domain RPCs capturing all role actions, no delete/update | Vitest DB & Playwright |
| **23** | Feature-Flagged AI Extraction Adapter | AI (`src/lib/ai`) | `FormExtractionProvider` with `MockFormExtractionProvider` test double | Vitest Unit & E2E |
| **24** | Follow-up Head Analytics Dashboard | Analytics (`/follow-up-head`) | Throughput metrics, overdue rates, zero clinical text exposure | Playwright E2E & RLS |
| **25** | E2E Testing Suite (Tiers 1-4) | Comprehensive Test Harness | 4-tier test plan execution, Section 17 13-step scenario | Playwright Test Suite |
| **26** | Adversarial Hardening (Tier 5) | Security & RLS | IDOR injection, privilege escalation, cross-dept tampering, MIME bypass | Playwright & Security Tests|
| **27** | Full Build Verification & Remote Git Push| Release & CI/CD | Zero lint errors, strict typecheck pass, production build pass | CI / NPM scripts |

---

## 3. Test Architecture & Tooling

### 3.1 Directory Layout
```
tests/
├── fixtures/                       # Deterministic test fixtures & synthetic data
│   ├── auth-users.ts               # Synthetic user credentials for all 7 roles
│   ├── synthetic-patients.ts       # Synthetic patient demographics & contacts
│   ├── clinical-forms.ts           # Sample follow-up data & valid mock scans
│   └── schedule-rules.ts           # Timezone & date calculation fixtures
├── helpers/                        # Test doubles, utilities & client wrappers
│   ├── supabase-test-client.ts     # Direct DB & Auth client helpers
│   ├── mock-ai-provider.ts         # Deterministic AI extraction test double
│   ├── time-travel.ts              # Asia/Kolkata calendar day math & clock mock
│   └── storage-helpers.ts          # Magic byte validator & test file generators
├── unit/                           # Fast, isolated Vitest contract & rule tests
│   ├── contracts-validation.test.ts# Zod schemas & domain boundary validation
│   ├── overdue-date-math.test.ts   # Asia/Kolkata +2/+4 calendar day calculations
│   ├── reminder-strategy.test.ts   # Defensive needs_configuration checks
│   └── storage-magic-bytes.test.ts # File magic byte & MIME verification
├── integration/                    # Vitest API route & database workflow tests
│   ├── access-request-api.test.ts  # Public access request & token hashing
│   ├── reminder-cron-worker.test.ts# Cron queue SKIP LOCKED & 3-retry cap
│   └── audit-logging-immutability.test.ts # DB trigger & audit event immutability
└── e2e/                            # Playwright end-to-end browser specifications
    ├── section-17-demo.spec.ts     # Authoritative 13-step connected scenario
    ├── tier1-auth-lifecycle.spec.ts# Features 1-6: Public access to IT approval
    ├── tier1-clinical-intake.spec.ts# Features 7-14: Registration to DH approval
    ├── tier1-operations-pool.spec.ts# Features 15-24: Tasks, inquiries, analytics
    ├── tier2-boundary-corner.spec.ts# Edge cases, date bounds, retry limits
    ├── tier3-concurrency-races.spec.ts # Stale versions, dual approvals, races
    └── tier4-clinical-workflows.spec.ts# Shared contact privacy, escalation loops
```

### 3.2 Runner Configurations
- **Playwright (`playwright.config.ts`):**
  - Drivers: Chromium, Firefox, WebKit, Mobile Chrome.
  - Base URL: `http://localhost:3000` (or `process.env.PLAYWRIGHT_TEST_BASE_URL`).
  - Action Timeout: 15,000 ms; Assertion Timeout: 10,000 ms.
  - Video and Screenshots: Recorded on failure.
  - Traces: Retained on first retry for debugging.
  - WebServer: Auto-spawns Next.js test server if not already running.
- **Vitest (`vitest.config.ts`):**
  - Environment: `node` (with `@` path alias mapped to `src/`).
  - Execution: Fast in-memory execution for contract validation, date algorithms, and RLS mocks.

---

## 4. 4-Tier Test Plan

### 4.1 Tier 1: Feature Coverage (>=5 Test Cases per Feature for Features 1–27)

#### Feature 1: Project Scaffolding & Git Remote
- `TC-01-01`: Package manifest specifies Next.js 15, TypeScript 5+, Tailwind CSS v4, Lucide React, and Supabase dependencies.
- `TC-01-02`: TypeScript compilation passes under strict mode (`"strict": true`, `"noImplicitAny": true`) with zero errors.
- `TC-01-03`: ESLint passes across all source and test directories with zero warnings or errors.
- `TC-01-04`: Production build command (`next build`) compiles without bundle errors or unhandled promises.
- `TC-01-05`: Git configuration points to target remote `https://github.com/arthur44558/dd` on branch `main`.

#### Feature 2: Supabase Multi-Client Setup
- `TC-02-01`: Browser client initializes with public URL and publishable key without leaking secret keys.
- `TC-02-02`: Server SSR client properly parses and sets HTTP-only session cookies in Next.js Server Components.
- `TC-02-03`: Server Action client correctly propagates authenticated user context to database queries.
- `TC-02-04`: Admin Service-Role client is restricted to server-side secure routes and rejected if loaded in browser bundle.
- `TC-02-05`: Expired or corrupted session tokens are safely cleared without unhandled runtime exceptions.

#### Feature 3: Public Access Request Workflow
- `TC-03-01`: Public user submits valid access request; status is set to `pending` with generated tracking token.
- `TC-03-02`: Access request form strictly validates email format, phone format, and required clinical justification.
- `TC-03-03`: Pending request cannot sign in via Supabase Auth (no `auth.users` row is created before IT approval).
- `TC-03-04`: Tracking endpoint (`/request-access/status`) retrieves correct request status using hashed token.
- `TC-03-05`: Rapid successive submissions from the same IP trigger rate limiting feedback.

#### Feature 4: IT Admin Account Management
- `TC-04-01`: IT Admin views queue of pending access requests with applicant details and justification.
- `TC-04-02`: IT Admin approves request; system triggers Auth invite and creates profile in `invited` status.
- `TC-04-03`: IT Admin rejects request with mandatory rejection reason; applicant status changes to `rejected`.
- `TC-04-04`: IT Admin deactivates an active user; user's active session is terminated and subsequent logins blocked.
- `TC-04-05`: IT Admin reactivates a deactivated user; user regains access with same UUID and intact historical audit logs.

#### Feature 5: Role-Based Authenticated Shell
- `TC-05-01`: Top navigation displays authenticated user's name, assigned role, and department badge.
- `TC-05-02`: System header displays the operational hospital timezone badge (`Asia/Kolkata`).
- `TC-05-03`: Role navigation items render only permitted routes for the current active role.
- `TC-05-04`: Logout button terminates session, destroys cookies, and redirects to public landing page `/`.
- `TC-05-05`: Mobile viewport correctly collapses navigation into an accessible sidebar drawer.

#### Feature 6: 6 Operational Dashboard Skeletons
- `TC-06-01`: Receptionist signs in and lands on `/reception` showing patient search and registration widgets.
- `TC-06-02`: Doctor's Assistant signs in and lands on `/assistant` showing pending intake queue and doctor selector.
- `TC-06-03`: Doctor signs in and lands on `/doctor` showing assigned patient follow-ups and review actions.
- `TC-06-04`: Department Head signs in and lands on `/department-head` showing approval workspace and change diffs.
- `TC-06-05`: Coordinator signs in and lands on `/coordinator` showing "My Tasks" queue and simulated communication actions.
- `TC-06-06`: Follow-up Head signs in and lands on `/follow-up-head` showing aggregate operational metrics.

#### Feature 7: Patient Registration & Contact Management
- `TC-07-01`: Reception registers a new patient with primary phone, generating a unique synthetic MRN.
- `TC-07-02`: Registration supports multiple contact numbers with distinct relationship labels (Self, Spouse, Caregiver).
- `TC-07-03`: Marking a phone number as "Shared Contact" flags the record and displays prominent privacy warnings.
- `TC-07-04`: Contact verification status can be toggled to `verified` after phone confirmation.
- `TC-07-05`: Reception cannot view or edit clinical diagnosis, severity, or clinical notes during registration.

#### Feature 8: Patient Deduplication Search RPC
- `TC-08-01`: Searching by exact 10-digit phone number returns all matching patient records.
- `TC-08-02`: Searching by partial name and date of birth returns matching patient candidates.
- `TC-08-03`: Ambiguous search matches display a disambiguation warning dialog preventing accidental selection.
- `TC-08-04`: Search by exact MRN returns exactly one unique patient record.
- `TC-08-05`: SQL injection payloads in search query are safely escaped and parameterized without error.

#### Feature 9: Assistant Clinical Intake & Scan Upload
- `TC-09-01`: Assistant selects registered patient, assigns doctor, and submits manual intake form.
- `TC-09-02`: Assistant uploads valid scan (PDF/PNG); file is stored in private bucket with calculated SHA-256 hash.
- `TC-09-03`: Private scan URL is generated as a short-lived signed URL (lifetime <= 60 seconds).
- `TC-09-04`: Non-image/non-PDF files (e.g., .exe, .sh, .html) are rejected with MIME validation errors.
- `TC-09-05`: Assistant saves draft intake; draft remains editable before final submission.

#### Feature 10: Doctor Review & Submission
- `TC-10-01`: Doctor reviews pending intake submitted by Assistant for their department.
- `TC-10-02`: Doctor confirms clinical parameters (severity, appointment date, follow-up required = Yes).
- `TC-10-03`: Doctor submits follow-up; record transitions to `SUBMITTED` status and creates initial Version 1 snapshot.
- `TC-10-04`: If Follow-up Required is set to `No`, record is finalized without generating reminder jobs.
- `TC-10-05`: Doctor cannot submit a follow-up with a missing appointment date when Follow-up Required is `Yes`.

#### Feature 11: Submitted Record Immutability
- `TC-11-01`: Direct SQL `UPDATE` on `follow_ups` in `SUBMITTED` status by Assistant is blocked by RLS.
- `TC-11-02`: Direct SQL `UPDATE` on `follow_ups` by Doctor is blocked by RLS.
- `TC-11-03`: Direct SQL `DELETE` on `follow_ups` is blocked for all operational roles.
- `TC-11-04`: UI disables inline editing on submitted follow-up view, displaying "Immutable Record" badge.
- `TC-11-05`: Direct API PATCH/PUT request to modify submitted follow-up returns HTTP 403 Forbidden.

#### Feature 12: Correction Request & Version Governance
- `TC-12-01`: Doctor submits a correction proposal specifying changed fields, base version (v1), and clinical reason.
- `TC-12-02`: Correction proposal is stored in `correction_proposals` with status `pending_approval`.
- `TC-12-03`: Active follow-up record remains unchanged while correction proposal is pending.
- `TC-12-04`: Proposal tracks the requesting user UUID and timestamp for complete auditability.
- `TC-12-05`: Assistant can prepare a correction proposal on behalf of a doctor with supporting documentation.

#### Feature 13: Department Head Approval Workspace
- `TC-13-01`: Department Head views queue of pending correction proposals for their department only.
- `TC-13-02`: Side-by-side comparison panel highlights proposed changes against current version values.
- `TC-13-03`: Department Head approves proposal: atomically advances version to v2, updates active record, and logs approval.
- `TC-13-04`: Department Head rejects proposal with required explanation: record remains on v1 unchanged.
- `TC-13-05`: Department Head cannot approve a correction proposal belonging to another department.

#### Feature 14: Stale Proposal Handling
- `TC-14-01`: Competing proposal B created against base v1 while proposal A is pending approval.
- `TC-14-02`: When proposal A is approved (advancing record to v2), proposal B is flagged as `STALE_CONFLICT`.
- `TC-14-03`: Attempting to approve stale proposal B fails with error requiring review against new base v2.
- `TC-14-04`: Submitting a proposal with an invalid or past base version is rejected.
- `TC-14-05`: Concurrency control uses optimistic locking or `SELECT FOR UPDATE` to prevent race conditions.

#### Feature 15: Pluggable Reminder Schedule Strategy
- `TC-15-01`: System initializes `ReminderScheduleStrategy` in default `needs_configuration` state.
- `TC-15-02`: When unconfigured, follow-up submission does not generate unauthorized pre-appointment reminder jobs.
- `TC-15-03`: Strategy interface permits plugging approved hospital schedule configs without code refactoring.
- `TC-15-04`: System logs an audit warning if schedule generation is attempted while strategy is unconfigured.
- `TC-15-05`: Follow-up status correctly reflects `ACTIVE` awaiting reminder schedule activation.

#### Feature 16: Confirmed Overdue Engine
- `TC-16-01`: Confirmed overdue engine evaluates appointment dates in `Asia/Kolkata` timezone at local midnight.
- `TC-16-02`: Follow-up transitioning past appointment date generates Overdue Task 1 at exactly +2 calendar days.
- `TC-16-03`: Follow-up remaining unconfirmed generates Overdue Task 2 at exactly +4 calendar days.
- `TC-16-04`: No further automatic overdue texts are scheduled after +4 calendar days.
- `TC-16-05`: Follow-up status transitions to `OVERDUE` upon generation of +2 day task.

#### Feature 17: Reliable Reminder Queue & Cron Worker
- `TC-17-01`: Cron endpoint `/api/cron/process-reminders` requires valid authorization bearer secret.
- `TC-17-02`: Worker claims pending jobs using `SELECT ... FOR UPDATE SKIP LOCKED` to prevent duplicate processing.
- `TC-17-03`: Failed job processing increments retry count and sets exponential backoff delay.
- `TC-17-04`: Maximum retry attempts are strictly capped at 3; jobs exceeding 3 retries transition to `FAILED`.
- `TC-17-05`: Worker execution is idempotent: repeated immediate runs do not process the same job twice.

#### Feature 18: Coordinator Task Queue & Simulated Sends
- `TC-18-01`: Coordinator views assigned follow-ups in "My Tasks" categorized by Due Today, Overdue, and Upcoming.
- `TC-18-02`: Clicking "Simulate Text Send" records a `MANUALLY_CONFIRMED_SIMULATED_SEND` communication attempt.
- `TC-18-03`: UI prominently displays: `"Manually confirmed / simulated — not provider verified"`.
- `TC-18-04`: Simulated attempt records coordinator UUID, timestamp, channel, and simulated message template.
- `TC-18-05`: Coordinator cannot see or action tasks assigned to other coordinators without permission.

#### Feature 19: Follow-up Outcome Recording
- `TC-19-01`: Coordinator logs successful call outcome: patient confirmed attendance for scheduled follow-up.
- `TC-19-02`: Coordinator logs outcome: patient requested reschedule; system triggers doctor review workflow.
- `TC-19-03`: Coordinator logs outcome: patient declined follow-up; record is flagged for clinical review.
- `TC-19-04`: Coordinator logs outcome: patient unreachable after maximum attempts; flagged as `LOST_TO_FOLLOW_UP`.
- `TC-19-05`: Logging completion outcome terminates active reminder cycle and cancels pending future jobs.

#### Feature 20: Contextual Clinical Inquiries
- `TC-20-01`: Coordinator opens inquiry thread attached to specific follow-up requesting medication clarification.
- `TC-20-02`: Assistant receives notification, reviews inquiry, and provides clarification response.
- `TC-20-03`: Assistant escalates complex inquiry to treating Doctor with clinical note attachment.
- `TC-20-04`: Doctor responds in thread; all messages are immutably logged with sender UUID and timestamp.
- `TC-20-05`: Inquiry thread cannot be viewed by unauthorized users outside the assigned care team.

#### Feature 21: Notification Center
- `TC-21-01`: Department Head receives in-app notification when a new correction proposal is submitted.
- `TC-21-02`: Coordinator receives in-app notification when a task becomes overdue (+2 days).
- `TC-21-03`: Notification counter in top header increments in real-time or upon polling.
- `TC-21-04`: Clicking notification marks it as read and deep-links directly to target record.
- `TC-21-05`: Notification access is strictly scoped to the recipient user UUID via RLS.

#### Feature 22: Immutable Audit Logging
- `TC-22-01`: Every access approval, patient registration, follow-up submission, and version change writes to `audit_events`.
- `TC-22-02`: Audit event records actor UUID, action name, resource type, resource ID, IP address, and payload delta.
- `TC-22-03`: Direct SQL `UPDATE` on `audit_events` is denied for all roles including IT Admin.
- `TC-22-04`: Direct SQL `DELETE` on `audit_events` is denied for all roles including IT Admin.
- `TC-22-05`: IT Admin security console allows filtering audit logs by actor, event type, and date range.

#### Feature 23: Feature-Flagged AI Extraction Adapter
- `TC-23-01`: AI extraction provider defaults to disabled state (`AI_FORM_EXTRACTION_ENABLED=false`).
- `TC-23-02`: When enabled, `MockFormExtractionProvider` processes scan and returns draft field proposals.
- `TC-23-03`: Assistant UI presents extracted fields with confidence badges requiring manual review and acceptance.
- `TC-23-04`: AI proposals cannot autonomously submit follow-up records or approve clinical parameters.
- `TC-23-05`: Extracted text is sanitized to prevent prompt injection or script execution in review UI.

#### Feature 24: Follow-up Head Analytics Dashboard
- `TC-24-01`: Follow-up Head dashboard calculates department follow-up completion rates.
- `TC-24-02`: Dashboard displays coordinator workload distribution and task aging metrics.
- `TC-24-03`: Overdue rate trends (+2 vs +4 days) are displayed across departments.
- `TC-24-04`: Dashboard queries aggregate numbers and strictly suppresses patient names and clinical notes.
- `TC-24-05`: Analytics queries enforce RLS and do not bypass database security policies.

#### Feature 25: E2E Testing Suite (Tiers 1-4)
- `TC-25-01`: Playwright test runner executes full Tier 1 feature suite across all 7 user roles.
- `TC-25-02`: Runner executes Tier 2 boundary and corner case suite with 100% pass rate.
- `TC-25-03`: Runner executes Tier 3 concurrency and race condition suite with zero race failures.
- `TC-25-04`: Runner executes Tier 4 Section 17 13-step connected scenario end-to-end.
- `TC-25-05`: HTML and JUnit test reports are generated with screenshot/trace artifacts on failure.

#### Feature 26: Adversarial Hardening (Tier 5)
- `TC-26-01`: IDOR injection: Reception user attempting to fetch clinical scan signed URL is denied (HTTP 403).
- `TC-26-02`: Privilege escalation: Coordinator attempting to call IT account approval API is denied (HTTP 403).
- `TC-26-03`: Cross-department tampering: Cardiology Dept Head approving Neurology proposal is rejected.
- `TC-26-04`: Storage upload bypass: Renaming executable `.exe` to `.pdf` fails magic byte inspection.
- `TC-26-05`: Stale token injection: Revoked session JWT attempting to query patient records is denied.

#### Feature 27: Full Build Verification & Remote Git Push
- `TC-27-01`: Zero ESLint warnings or errors across the entire codebase.
- `TC-27-02`: Strict TypeScript typecheck (`tsc --noEmit`) passes with zero errors.
- `TC-27-03`: Vitest unit and integration suites pass 100%.
- `TC-27-04`: Next.js production build (`npm run build`) completes successfully.
- `TC-27-05`: Git commit and push to remote `https://github.com/arthur44558/dd` branch `main` succeeds.

---

### 4.2 Tier 2: Boundary & Corner Cases (>=5 Cases per Feature Domain)

#### Phone Number Formatting & Sanitization
- `TC-BND-01`: Valid Indian mobile number with country code `+919876543210` normalizes to `+91 98765 43210`.
- `TC-BND-02`: 10-digit number without country code `9876543210` correctly prepends default `+91`.
- `TC-BND-03`: Number with whitespace, dashes, and parentheses `(09876) 543-210` is stripped and normalized.
- `TC-BND-04`: Number containing letters or illegal characters `98765ABCD0` fails validation with descriptive error.
- `TC-BND-05`: Short numbers (<10 digits) or excessive numbers (>15 digits) fail E.164 formatting validation.

#### Asia/Kolkata Calendar Math & Midnight Crossovers
- `TC-BND-06`: Follow-up scheduled for 2026-10-31 evaluates overdue at 2026-11-01 00:00:00 Asia/Kolkata.
- `TC-BND-07`: +2 day overdue task triggers at 2026-11-02 00:00:00 Asia/Kolkata regardless of UTC offset shifts.
- `TC-BND-08`: +4 day overdue task triggers at 2026-11-04 00:00:00 Asia/Kolkata; no +5 day task is generated.
- `TC-BND-09`: Crossover over month-end boundary (e.g. Feb 28 to March 2 in leap/non-leap year) calculates accurately.
- `TC-BND-10`: Job execution during midnight DST transitions (if server host is UTC) preserves exact local date.

#### Storage Upload & Magic Byte Verification
- `TC-BND-11`: Valid PDF file with `%PDF-` header magic bytes (`0x25, 0x50, 0x44, 0x46`) is accepted.
- `TC-BND-12`: Valid PNG file with `\x89PNG` header magic bytes (`0x89, 0x50, 0x4E, 0x47`) is accepted.
- `TC-BND-13`: Executable file disguised as `.pdf` (`MZ` header `0x4D, 0x5A`) is rejected immediately.
- `TC-BND-14`: Zero-byte empty upload file is rejected with "Empty file provided" error.
- `TC-BND-15`: File exceeding 10MB maximum upload limit is rejected before storage write.

#### Max 3-Retry Cap & Backoff
- `TC-BND-16`: Initial failure transitions reminder job to retry attempt 1 with scheduled backoff.
- `TC-BND-17`: Second consecutive failure transitions job to retry attempt 2.
- `TC-BND-18`: Third failure transitions job to retry attempt 3.
- `TC-BND-19`: Fourth failure strictly triggers permanent `FAILED` state; no 4th retry is attempted.
- `TC-BND-20`: Manual retry by IT Admin resets retry counter to 0 with required audit reason.

#### Clinical Intake & Boundary Conditions
- `TC-BND-21`: `follow_up_required = false` with populated appointment date throws validation error or clears date.
- `TC-BND-22`: `follow_up_required = true` with past appointment date throws warning requiring explicit override.
- `TC-BND-23`: Severity field set to invalid string (not `routine`, `moderate`, `high`, `critical`) is rejected by Zod.
- `TC-BND-24`: Clinical notes exceeding 5,000 characters are safely capped or rejected with clear message.
- `TC-BND-25`: Double-clicking submission button triggers UI debounce preventing duplicate record creation.

---

### 4.3 Tier 3: Cross-Feature Combinations & Concurrency

- `TC-CNC-01`: **Simultaneous IT Admin Approvals:** Two IT Admins attempt to approve the same pending account request concurrently. The database uses `SELECT ... FOR UPDATE` ensuring exactly one approval succeeds and the other receives a conflict notification.
- `TC-CNC-02`: **Stale Proposal Race Condition:** Assistant A and Doctor B submit correction proposals against Version 1 simultaneously. When Department Head approves Proposal A, Version increments to 2. Proposal B is atomically flagged as `STALE_CONFLICT`.
- `TC-CNC-03`: **Deactivation During Active Handling:** IT Admin deactivates Coordinator C while C is actively recording a communication outcome. C's current session token is invalidated on the next server request, rejecting the save and creating an unassigned task alert.
- `TC-CNC-04`: **Schedule Invalidation on Approved Reschedule:** An active follow-up has pending +2/+4 overdue reminder jobs. Department Head approves a date change from 2026-11-01 to 2026-11-15. The transaction atomically cancels old pending reminder jobs and re-anchors the schedule to the new date.
- `TC-CNC-05`: **Discharge Cycle Completion Cascade:** Patient attends follow-up appointment; Doctor logs completion outcome. The system atomically marks the follow-up cycle `COMPLETED`, cancels all pending reminder jobs, and removes the case from the Coordinator task queue.
- `TC-CNC-06`: **Priority Reassignment Override:** Follow-up Head overrides Coordinator assignment for an urgent high-severity case. The system updates the assigned coordinator, logs an audit override event with justification, and sends an urgent notification to the new assignee.

---

### 4.4 Tier 4: Real-World Clinical Workflows & Section 17 Demo Scenario

The authoritative test suite culminates in the **Section 17 13-Step Connected Demo Scenario** (`tests/e2e/section-17-demo.spec.ts`), executing sequentially in a single connected environment:

1. **Step 1 — Public Access Request:** Visitor loads `/` and submits access request for Dr. Sarah Jenkins (Doctor role, Cardiology).
2. **Step 2 — IT Queue Inspection:** IT Admin logs in, verifies the request is pending, and confirms no `auth.users` row exists yet.
3. **Step 3 — IT Approval & Account Activation:** IT Admin approves request; invite token is generated; user accepts invite, sets password, and profile becomes `active` with role `doctor`.
4. **Step 4 — 6 Operational Logins:** Reception, Assistant, Doctor, Department Head, Coordinator, and Follow-up Head each sign in and verify exclusive landing on their designated dashboard.
5. **Step 5 — Patient Registration & Shared Contact:** Reception searches for existing patient, registers synthetic patient "Rajesh Kumar", marks secondary phone as `Shared Contact`, and verifies privacy banner.
6. **Step 6 — Assistant Intake & Scan Upload:** Assistant digitises doctor follow-up sheet for Rajesh Kumar, uploads synthetic scan PDF to private bucket, verifies preview, and submits.
7. **Step 7 — Doctor Review & Correction Request:** Doctor views assigned follow-up, reviews clinical parameters, and initiates a correction request for appointment date and severity.
8. **Step 8 — Proposal & Department Head Approval:** Assistant prepares correction proposal; Cardiology Department Head reviews side-by-side diff, approves atomically, advancing record to Version 2.
9. **Step 9 — Reminder Generation & Simulated Send:** Scheduled reminder engine creates coordinator task; Coordinator reviews task, confirms simulated text send, and records patient confirmation.
10. **Step 10 — Clinical Query Thread Escalation:** Coordinator raises inquiry regarding medication adherence; Assistant routes to Doctor; Doctor provides authoritative reply.
11. **Step 11 — Workload Prioritisation:** Follow-up Head reviews operational metrics, detects workload imbalance, and assigns priority case with required audit justification.
12. **Step 12 — Account Revocation with Attribution:** IT Admin deactivates test user; user's active session is instantly terminated while all historical actions remain attributed in `audit_events`.
13. **Step 13 — Cross-Role & Cross-Department Security Enforcement:** Reception attempting to view clinical notes is blocked; Coordinator attempting to access unassigned case is blocked; foreign Department Head attempting to approve Cardiology proposal is denied by RLS.

---

## 5. Mocking, Test Doubles & Isolation Strategies

1. **Supabase SSR Test Client (`tests/helpers/supabase-test-client.ts`):**
   Provides helper methods to authenticate test sessions using signed cookies or service-role administrative tokens without requiring manual browser login sequences for backend tests.
2. **Mock AI Extraction Provider (`tests/helpers/mock-ai-provider.ts`):**
   Deterministic implementation of `FormExtractionProvider`. Yields predictable extracted form fields and confidence metrics from synthetic test scans without connecting to external paid third-party AI APIs.
3. **Time-Travel Clock Helper (`tests/helpers/time-travel.ts`):**
   Mocks server time in `Asia/Kolkata` timezone to reliably test +2 calendar day and +4 calendar day midnight overdue transitions without wall-clock sleep delays.
4. **Simulated Communications Recorder:**
   Intercepts outbound reminder tasks in memory or database table `communication_attempts`, verifying that payloads are structured correctly and marked with `MANUALLY_CONFIRMED_SIMULATED_SEND`.
