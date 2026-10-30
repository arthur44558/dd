# Handoff Report — QA, Testing, Security, and Compliance Specification Survey

**Author:** `teamwork_explorer` (Survey 3)  
**Task:** Survey 3 — In-depth survey of QA mandates, 4-tier testing model, validation constraints, edge cases, security/privacy/audit rules, and test harness / verification scripts from `HOSPITAL_FOLLOWUP_BUILD_SPEC.md`.  
**Working Directory:** `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_survey_3\`  
**Target Spec File:** `c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md`  

---

## 1. Observation

Direct observations from examining `c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md` (Total 1,189 lines, 74,648 bytes):

1. **Definition of Done & Working Product Mandate:**
   - Section 0, Lines 18–19: *"Implement in vertical slices: database migration → RLS → server-side service/action → UI → automated tests. Do not build front-end screens against fake arrays and promise to connect them later. Every visible control must perform a real, authorised action or be clearly disabled with an explanation. No dead buttons, fake success toasts, fake charts, hard-coded counts, or placeholder links."*
   - Section 0, Lines 30–33: *"The app is only complete when an authorised user can sign in, land on the correct role dashboard, complete their permitted workflows, see persistent database-backed updates, and be denied every prohibited action in both the UI and the database/API."*
2. **Mandatory Technology & Testing Stack:**
   - Section 2.1, Lines 81–96: Web framework is `Next.js App Router` (TypeScript strict mode), UI is `Tailwind CSS + shadcn/ui + Lucide`, Validation is `Zod + React Hook Form`, Identity is `Supabase Auth`, Database is `Supabase PostgreSQL + RLS + pg_cron`, Files is `Supabase Storage`, and Testing stack is explicitly `Vitest, Playwright, Supabase CLI / pgTAP`.
   - Section 2.1, Line 97: Modular monolith; no microservices or external queue services unless measured.
3. **Dual-Layer Authorization & RLS Mandate:**
   - Section 0, Line 21: *"Enforce authorisation in PostgreSQL RLS and again in server-side domain operations. Front-end route guards are not a security boundary."*
   - Section 8.2, Line 672–674: *"Enable RLS on every table exposed through Supabase Data API... Revoke unnecessary grants; use separate SELECT, INSERT, UPDATE, and DELETE policies rather than broad FOR ALL policies. Default deny."*
   - Section 14.6, Line 1040: *"For every exposed table, test SELECT, INSERT, UPDATE, and DELETE separately for anon and each role. Include cross-department, wrong-owner, wrong-assignee, stale-user and random-UUID IDOR cases. Add SQL tests under supabase/tests/ and run supabase test db. A policy that has not been tested for both allowed and denied rows is not complete."*
4. **Explicit 4-Tier Testing & Edge Case Requirements:**
   - Section 14 enumerates tests across 5 major domains: 14.1 Authentication/account cases (Lines 979–992), 14.2 Patient and intake cases (Lines 993–1004), 14.3 Approvals/concurrency cases (Lines 1005–1015), 14.4 Scheduler/communications cases (Lines 1016–1027), 14.5 Coordinator and privacy cases (Lines 1028–1037).
   - Concurrency & Concurrency Races: Section 7.4 (Lines 644–652) and Section 14.3 (Lines 1009–1012): Stale proposal conflict detection, atomic version/schedule updates, optimistic locking.
   - Exact Calendar Overdue Logic: Section 6.3 (Lines 541–551): Transition to `OVERDUE`, exactly two reminder tasks (+2 calendar days and +4 calendar days in hospital timezone `Asia/Kolkata`), no further automatic overdue texts.
   - Reliability Cap: Section 6.4 (Line 561): Maximum total retry attempts capped at three.
   - Simulation Transparency: Section 6.5 (Line 574): UI language must state `"Manually confirmed / simulated — not provider verified"`.
5. **Security, Privacy (HIPAA/GDPR) & Health Data Protections:**
   - Synthetic Data Mandate: Section 0 Line 23 & Section 8.8 Line 738: Synthetic patient data only; demo data must be visibly labeled synthetic; zero real patient info.
   - Minimal Disclosure: Section 4.2 Line 321 (Reception sees no clinical notes), Section 4.6 Line 385 (Coordinator sees minimal contact details for assigned case only), Section 4.7 Line 400 (Follow-up Head sees metrics only; no clinical notes), Section 4.8 Line 413 (IT Admin has zero patient data access).
   - Shared Contact Rule: Section 5.1 Line 445: Shared phone warning must suppress diagnosis, severity, prescription, or sensitive clinical information.
   - Storage Quarantine & Signed URLs: Section 8.6 Lines 719–727: Private buckets, MIME & magic byte check, no public URLs, short-lived signed URLs (≤ 60s), preserve original bytes & hash.
   - Immutable Audit Events: Section 8.7 Lines 730–735: Triggers and domain RPCs; operational users cannot delete/update audit records.
6. **Open Decisions Defense (OQ-01 through OQ-16):**
   - Section 16 (Lines 1110–1132): 16 open questions must NOT be silently resolved; features like pre-appointment auto-scheduling must remain in `needs_configuration` / disabled state (Section 6.2 Line 536).
7. **Production Release Gates & Section 17 Demo Scenario:**
   - Section 15.4 (Lines 1089–1105): 14 mandatory release check gates before real patient use.
   - Section 17 (Lines 1137–1155): Authoritative 13-step connected end-to-end demonstration scenario.

---

## 2. Logic Chain

1. **Premise 1:** The product specification strictly prohibits mock-ups, static arrays, and dead controls (Observation 1).  
   **Deduction 1:** Every test must assert against persistent database state and live API / server action executions, not client-side in-memory stubs.

2. **Premise 2:** Authorization is doubly enforced in PostgreSQL RLS policies and server-side domain guards (Observation 3).  
   **Deduction 2:** Client-side test assertions alone cannot prove security. Testing requires two independent layers: (a) SQL-level RLS test scripts (`supabase test db`) running against all 27 tables for `anon` and all 7 roles verifying both granted and denied operations, and (b) Browser-level E2E tests (`Playwright`) verifying UI feedback, state, and API rejection for IDOR and privilege escalation attacks.

3. **Premise 3:** Healthcare data requires strict role isolation, shared-contact confidentiality, and immutable audit trails (Observation 5).  
   **Deduction 3:** Test suites must incorporate specific HIPAA/GDPR validation fixtures: verifying Reception cannot view clinical fields, verifying Coordinators see prominent warnings and sanitized scripts for shared contacts, verifying IT Admins cannot query patient tables, and verifying `audit_events` cannot be deleted or modified by any application role.

4. **Premise 4:** The specification identifies 16 open decisions (Observation 6) and forbids inventing clinical formulas or scheduling cadences without approval.  
   **Deduction 4:** The scheduler test harness must assert that the system enters a defensive `needs_configuration` state, generating zero automatic pre-appointment jobs, while successfully verifying the confirmed overdue (+2/+4 calendar days in `Asia/Kolkata`) logic and 3-retry attempt caps.

5. **Premise 5:** The authoritative 13-step connected scenario in Section 17 integrates all 7 roles, patient registration, scan upload, doctor correction, department head approval, simulated communication, query escalation, and IT deactivation (Observation 7).  
   **Deduction 5:** Constructing an automated Playwright test that executes the exact 13 steps sequentially serves as the ultimate end-to-end integration proof and primary acceptance gate for release.

---

## 3. Caveats

1. **Local Supabase Environment Dependency:** Comprehensive RLS and database testing via `supabase test db` requires the Supabase CLI and a running local Docker engine. In environments where Docker is unavailable, database RLS tests can be run against a connected Supabase development cloud project.
2. **Third-Party AI Credentials:** Adaption Labs integration is specified behind a disabled feature flag (`AI_FORM_EXTRACTION_ENABLED=false`). In accordance with Section 9.3, tests must use a deterministic test double (`MockFormExtractionProvider`) rather than live third-party API calls until hospital governance and API contracts are finalized.
3. **Simulated Outbound Communications:** The spec explicitly notes that no external SMS/telephony gateways exist in this release (Section 1.2 Line 59). Testing must assert the correct recording of `MANUALLY_CONFIRMED_SIMULATED_SEND` and call outcomes without attempting real external carrier verification.

---

## 4. Conclusion

The testing and QA mandates in `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` represent a rigorous, zero-tolerance verification regime tailored for hospital-grade clinical continuity software.

To achieve 100% compliance with the Definition of Done:
1. **Testing Architecture:** The testing harness must be structured into a 4-Tier Model:
   - **Tier 1 (Feature Coverage):** Vitest + Playwright covering all 7 roles, 6 dashboards, and 10 core subsystems.
   - **Tier 2 (Boundary & Corner Cases):** Input sanitization, patient deduplication disambiguation, timezone-aware calendar math (`Asia/Kolkata`), +2/+4 overdue boundaries, 3-retry caps, and storage MIME magic-byte validation.
   - **Tier 3 (Cross-Feature Combinations):** Concurrency races (simultaneous IT approvals, stale proposal invalidation, deactivation during active handling, reschedule cascades, cycle completion cancelling active jobs).
   - **Tier 4 (Real-World Clinical Scenarios):** Full 13-step Section 17 connected demo scenario, plus high-severity shared-contact privacy workflows.
2. **Security & RLS Guarantee:** 100% test coverage across all 27 tables for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` across `anon` and all 7 roles using `supabase test db`, confirming default-deny and zero IDOR vulnerability.
3. **Execution Pipeline:** Codified via standard scripts (`npm run lint`, `npm run type-check`, `npm run test:unit`, `npm run test:db`, `npm run test:e2e`, and `npm run build`), ensuring an automated, repeatable verification pipeline for the coding agents.

The complete, exhaustive 7-section survey has been compiled and saved to:
`c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_survey_3\analysis.md`.

---

## 5. Verification Method

To independently verify the findings and specifications documented in this report:

1. **Verify Authoritative Text & Line References:**
   Inspect the source specification file `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` at the cited line ranges:
   - Instructions and Definition of Done: Lines 13–35
   - Technology and Testing Stack: Lines 79–98
   - Roles and Permission Boundaries: Lines 293–432
   - Core Business Workflows: Lines 434–512
   - Reminder Engine Constraints & Overdue (+2/+4): Lines 514–588
   - Database Design & Concurrency: Lines 590–652
   - Mandatory Security & RLS Requirements: Lines 655–740
   - Required Testing Matrix and Edge Cases: Lines 977–1042
   - Production Deployment & Go-Live Gates (14 Gates): Lines 1044–1108
   - Open Decisions (OQ-01 through OQ-16): Lines 1110–1135
   - Required Demo Scenario (13 Steps): Lines 1137–1155

2. **Verify Detailed Deliverable:**
   Read the companion comprehensive analysis document:
   `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_survey_3\analysis.md`

3. **Validation & Test Execution Commands (for Coding Agents):**
   When implementation begins, execute the following commands in the workspace root to verify compliance:
   ```bash
   # 1. Static typing and lint validation
   npm run lint
   npm run type-check

   # 2. Unit and domain service tests
   npm run test:unit

   # 3. Database RLS and schema tests
   supabase test db

   # 4. End-to-end Playwright tests (verifying Section 17 13-step demo)
   npm run test:e2e

   # 5. Production build verification
   npm run build
   ```

4. **Invalidation Conditions:**
   This report would be invalidated if:
   - The product owner approves modifications to `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` altering the testing stack, role matrix, or 14 release gates.
   - Clinical governance resolves open decisions (e.g. approving a specific reminder cadence formula or multi-department membership model), requiring updates to the boundary and negative test matrices.
