# Handoff Report — In-Depth Specification Survey

**Author**: `teamwork_explorer_survey_1`  
**Recipient**: `orchestrator` (`554ca597-f10b-4913-a0ea-c197b485d283`)  
**Working Directory**: `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_survey_1\`  
**Target Specification**: `c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md`  
**Detailed Findings Document**: `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_survey_1\analysis.md`  
**Handoff Type**: Hard (Survey Task Complete)

---

## 1. Observation

Direct observations from examining `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` (1,189 lines total) and workspace environment:

1. **Product Purpose and Architectural Boundary** (Lines 36–76):
   - Line 38: *"Create a hospital patient-registration and follow-up continuity system. It digitises doctor-completed follow-up forms, maintains a trustworthy patient/follow-up history, creates appointment-anchored reminder tasks, coordinates follow-up work through a hospital-wide coordinator pool, and makes each action attributable and reviewable."*
   - Line 40: *"This is **not a full EHR**. It does not replace the hospital's clinical record system, prescription, doctor judgement, or established clinical governance."*
   - Line 97: *"Use a **modular monolith**. Do not introduce microservices, a separate FastAPI backend, Redis, or an external queue unless a measured requirement justifies it. The database and Supabase services are the system of record."*

2. **Core Roles and Dashboards** (Lines 9–10, 293–430):
   - Line 9: *"Core roles: Reception, Doctor's Assistant, Doctor, Department Head, Follow-up Coordinator, Follow-up Head. IT Head / IT Admin is a separate privileged account-management console, not one of the six operational dashboards."*
   - Line 298–307: Roles are strictly defined as `reception`, `assistant`, `doctor`, `department_head`, `coordinator`, `follow_up_head`, `it_admin`.

3. **Public Account Request vs IT Approval** (Lines 223–272):
   - Line 225: *"This is a **request**, not public registration. Public users must never choose or self-assign their final role. Disable public self-service sign-ups in Supabase Auth. The public website must not call `supabase.auth.signUp`; only the approved IT Admin invite workflow may create Auth users."*
   - Lines 257–258: *"Only after approval, use the server-only Supabase Auth Admin API to invite/create the Auth user. Prefer an email invite/password setup link; never generate, display, email, or store a shared plaintext temporary password."*

4. **Submitted Record Immutability & Department Head Approvals** (Lines 461–474):
   - Line 463: *"Submitted values are never edited directly by ordinary users."*
   - Lines 468: *"Approval must verify the proposal's base version is still current, lock the affected record, apply changes, create a new version, log approver and before/after values, and update any affected schedule in one transaction."*
   - Lines 469–470: *"Rejection requires a reason... Multiple pending requests may coexist. If one approval makes another proposal stale, flag it for renewed review; do not silently discard it or apply its now-outdated values."*

5. **Scheduling Engine & Overdue Rules** (Lines 516–551):
   - Lines 518–522: *"Appointment date is the anchor. Pre-appointment reminder times are generated backwards from the appointment. Intervals generally become shorter as the appointment approaches. All cases share one mathematical spacing function. First reminder is always a text task."*
   - Line 523: *"Severity changes the text/call mix, not the mathematical date-spacing function."*
   - Lines 528–540: *"Do not invent the schedule formula... Implement a `ReminderScheduleStrategy` interface and a versioned `schedule_configs` table... Until approved configuration exists: Keep the schedule feature marked `needs_configuration`."*
   - Lines 543–550: *"When appointment date passes without authorised resolution: Change follow-up to `OVERDUE`. Create an additional text task for appointment date +2 calendar days. Create a second additional text task for appointment date +4 calendar days... Calculate calendar days in the configured hospital timezone, not as a blind 48/96-hour offset."*

6. **Coordinator Tasks & Truthful Communications** (Lines 567–576):
   - Line 381: *"Manual simulated “Sent” confirmation, timestamp and actor. UI language must state **Manually confirmed / simulated — not provider verified**."*
   - Line 575: *"The history must never label this action “delivered”, “read”, or provider-verified."*

7. **Database Entities** (Lines 594–627):
   - Section 7.1 details 27 distinct relational tables: `profiles`, `account_requests`, `account_request_events`, `departments`, `department_memberships`, `doctor_profiles`, `patients`, `patient_contacts`, `patient_profile_versions`, `consultations`, `follow_ups`, `follow_up_versions`, `source_documents`, `correction_requests`, `correction_request_items`, `approval_decisions`, `schedule_configs`, `reminder_schedules`, `reminder_jobs`, `communication_tasks`, `communication_attempts`, `follow_up_outcomes`, `coordinator_assignments`, `coordinator_workload_events`, `internal_queries`, `query_messages`, `notifications`, `audit_events`, and `ai_assistance_events`.

8. **Security and RLS Mandate** (Lines 655–736):
   - Line 671: *"Enable RLS on **every** table exposed through Supabase Data API, including join tables and views where applicable."*
   - Line 673: *"Default deny. Grant only specific operations required by a role."*
   - Line 701: *"Restrict admin client usage to specific server-only IT/admin modules. Never use an admin client for normal user reads, since it bypasses RLS."*

9. **Open Decisions Explicitly Preserved** (Lines 1110–1132):
   - 16 distinct open questions (OQ-01 through OQ-16) cataloged in Section 16, requiring configuration flags or disabled states rather than assumed implementation.

---

## 2. Logic Chain

1. **From Observation 1 & 2 to Module Architecture**:
   - Because the system is defined as a Next.js modular monolith centered on Supabase PostgreSQL and Storage, with distinct role workspaces, the application must be organized by domain features (`src/features/*`) rather than distributed microservices or separate backends. Each feature must isolate its server-side services, data operations, Zod schemas, and UI components.

2. **From Observation 3 to Authentication & Onboarding Workflow**:
   - Because public registration is prohibited and users cannot select their final role, the public `/request-access` route must only insert into `account_requests` with a hashed status token.
   - The IT Admin must review the request and trigger an Auth invite via `@supabase/supabase-js` Admin API, creating a mapped `profiles` row with status `invited`.
   - The profile must remain inoperative until the user accepts the invite at `/invite/accept` and sets a password, transitioning status to `active`.
   - The server helper `requireUser()` must reject any account that is not `active`, closing security loopholes even if a JWT exists.

3. **From Observation 4 to Record Mutation & Clinical Governance**:
   - Because submitted records are strictly immutable, standard SQL `UPDATE` operations on `follow_ups` must be blocked by RLS for all operational users (Reception, Assistant, Doctor, Coordinator).
   - Any modification must be encapsulated as a proposal in `correction_requests` + `correction_request_items`.
   - The Department Head approval process must be executed within an ACID database transaction: verifying that `base_version` equals `current_version` under a row lock (`FOR UPDATE`), applying proposed values, creating a snapshot row in `follow_up_versions`, cancelling unsent reminder jobs from the superseded schedule, generating a new schedule, and logging to `audit_events`.
   - Competing proposals referencing an older version must transition to `stale` to avoid applying outdated changes.

4. **From Observation 5 & 6 to Scheduler Design**:
   - The schedule generator cannot assume an unverified mathematical cadence. It must be abstracted behind a `ReminderScheduleStrategy` interface.
   - Since specific parameters are marked `OPEN` (OQ-04, OQ-05, OQ-06), the system must store configuration in `schedule_configs` and keep automatic job generation in a `needs_configuration` state until configured by an administrator.
   - However, the overdue logic (+2 and +4 calendar days relative to local midnight) is fully confirmed and must be implemented deterministically using the configured hospital timezone (`Asia/Kolkata`).
   - Communication actions are simulated; recording an action must insert into `communication_attempts` with `attempt_type = 'manual_simulated_send'` and display the mandatory disclaimer.

5. **From Observation 7, 8 & 9 to Data Layer & RLS Implementation**:
   - The 29 relational tables mapped in `analysis.md` must be constructed via versioned SQL migrations under `supabase/migrations/`.
   - Foreign keys, check constraints (e.g. `retry_count <= 3`, `follow_up_required = false OR appointment_date IS NOT NULL`), and unique constraints (e.g. `idempotency_key`, `patient_id`) must enforce data integrity at the database engine level.
   - RLS policies must strictly enforce role and department boundaries, using custom PostgreSQL security functions (`auth_user_role()`, `auth_user_department()`, `auth_user_status()`).

---

## 3. Caveats

1. **Schedule Cadence Unspecified**: The exact mathematical date-spacing formula and severity text/call ratios are explicitly open (OQ-04, OQ-05). Implementation must mock/abstract this behind an interface and not deploy an invented formula as approved.
2. **Daytime Calling Window Unspecified**: The exact hours of permitted contact (e.g. 09:00 to 18:00) are open (OQ-06). A configurable window must be provided.
3. **Multi-Department Membership Decision Pending**: The product owner has not decided whether doctors/assistants can belong to multiple departments simultaneously (OQ-01). The data model supports many-to-many via `department_memberships`, but default application behavior must restrict clinical users to one primary department.
4. **Third-Party Integrations Omitted**: Per specification, SMS, WhatsApp, telephony, and EHR integrations are out of scope for this release. All communications are simulated tasks.
5. **AI Integration Scope**: AI form extraction is optional and human-led. No live Adaption Labs API calls should be made without confirmed credentials and data privacy sign-off.

---

## 4. Conclusion

The specification `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` provides an unambiguous, complete blueprint for the data model, security policies, role boundaries, and business workflows. The domain cleanly segments into 29 relational entities across 8 core functional modules:
1. Identity, Profiles & Access Requests (`profiles`, `account_requests`, `account_request_events`, `departments`, `department_memberships`, `doctor_profiles`)
2. Patient Registration & Contacts (`patients`, `patient_contacts`, `patient_profile_versions`, `consultations`)
3. Follow-up Forms, Documents & Immutability (`follow_ups`, `follow_up_versions`, `source_documents`)
4. Change Governance & Approvals (`correction_requests`, `correction_request_items`, `approval_decisions`)
5. Reminders, Jobs & Overdue Logic (`schedule_configs`, `reminder_schedules`, `reminder_jobs`)
6. Coordinator Pool, Tasks & Simulated Communications (`communication_tasks`, `communication_attempts`, `coordinator_assignments`, `coordinator_workload_events`, `follow_up_outcomes`)
7. Cross-Role Collaboration & Alerts (`internal_queries`, `query_messages`, `notifications`)
8. Audit & AI Governance (`audit_events`, `ai_assistance_events`)

The detailed analysis document `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_survey_1\analysis.md` provides the complete specification inventory, data models, API endpoints, state machines, and open question mitigations needed by downstream decomposition and implementation agents.

---

## 5. Verification Method

To independently verify the findings in this report:

1. **Inspect Analysis and Specification Alignment**:
   - Compare `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_survey_1\analysis.md` against `c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md`.
   - Verify table list against Section 7.1 (lines 594–627).
   - Verify role definitions against Section 4.1 (lines 295–307).
   - Verify open decisions against Section 16 (lines 1110–1132).

2. **Schema & Contract Verification (Post-Implementation)**:
   - When database migrations are applied: run `supabase test db` to verify all 29 tables, foreign keys, and RLS policies.
   - Run Vitest unit tests on domain services:
     ```powershell
     npm run test
     ```
   - Run type checking:
     ```powershell
     npm run type-check
     ```
   - Run Playwright role-based journey tests:
     ```powershell
     npx playwright test
     ```

3. **Invalidation Conditions**:
   - If the product owner alters the role hierarchy (e.g. makes IT Admin an operational role, or merges Assistant into Doctor).
   - If direct in-place editing of submitted follow-ups is allowed without Department Head approval.
   - If automated patient messaging (real SMS/telephony) is added to the release scope.
