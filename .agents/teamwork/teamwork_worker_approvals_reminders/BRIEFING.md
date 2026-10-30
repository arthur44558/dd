# BRIEFING — 2026-10-30T04:25:00Z

## Mission
Implement Milestone 3 & 4: SQL Migration 20261030000003_m3_m4_approvals_reminders.sql with 100% RLS, Approvals Governance (`src/features/approvals/`), Reminder Engine & Overdue Generator (`src/features/reminders/`), Cron Worker (`src/app/api/cron/process-reminders/route.ts`), and Coordinator Pool & Tasks (`src/features/coordinator/`).

## 🔒 My Identity
- Archetype: teamwork_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_approvals_reminders\
- Original parent: 554ca597-f10b-4913-a0ea-c197b485d283
- Milestone: M3 & M4 (Approvals Governance, Reminder Engine, Cron Worker & Coordinator Pool)

## 🔒 Key Constraints
- 100% default-deny RLS on all tables: `correction_requests`, `correction_request_items`, `approval_decisions`, `schedule_configs`, `reminder_schedules`, `reminder_jobs`, `communication_tasks`, `communication_attempts`, `coordinator_assignments`, `coordinator_workload_events`, `follow_up_outcomes`.
- Exclusive file ownership:
  - `src/features/approvals/`
  - `src/features/reminders/`
  - `src/app/api/cron/process-reminders/route.ts`
  - `src/features/coordinator/`
  - `supabase/migrations/20261030000003_m3_m4_approvals_reminders.sql`
- Dept Head approval must be an ACID transaction with FOR UPDATE row lock, verify base_version == current_version, apply changes, increment current_version, snapshot to follow_up_versions, mark stale conflicting proposals, cancel unsent superseded jobs, write audit event.
- Rejection requires mandatory reason.
- ReminderScheduleStrategy in needs_configuration state without unapproved heuristics.
- Confirmed overdue engine: transitions follow-up to OVERDUE when appointment date passed; generates exactly two overdue text tasks (+2 and +4 calendar days in Asia/Kolkata).
- Cron route /api/cron/process-reminders with CRON_SECRET auth, SKIP LOCKED, max 3 retries.
- Coordinator "My Tasks" queue with priority ordering (severity first, nearest due date second).
- Simulated send in communication_attempts with attempt_type = 'manual_simulated_send' and mandatory UI disclaimer: "Manually confirmed / simulated — not provider verified".
- Follow-up outcome recording (completed, patient rescheduled, patient refused, lost to follow-up).
- Full type-check clean (`npx tsc --noEmit`).

## Current Parent
- Conversation ID: 554ca597-f10b-4913-a0ea-c197b485d283
- Updated: not yet

## Task Summary
- **What to build**: Migration 03, Approvals governance, Reminder engine & cron worker, Coordinator pool & simulated sends.
- **Success criteria**: All tables created with RLS, approval transaction atomic with row locks, overdue engine in Asia/Kolkata, cron route with SKIP LOCKED and 3 retries, coordinator queue & actions, clean type-check.
- **Interface contracts**: PROJECT.md, HOSPITAL_FOLLOWUP_BUILD_SPEC.md
- **Code layout**: PROJECT.md § Code Layout

## Key Decisions Made
- Implemented PostgreSQL ACID transactional RPCs (`approve_correction_request`, `reject_correction_request`, `evaluate_overdue_follow_ups`, `process_due_reminder_jobs`) to guarantee row locking, optimistic concurrency, and SKIP LOCKED job queue safety at the database tier.
- Supported RPCs with clean Next.js 15 Server Actions and Zod validation.
- Exported `MANDATORY_SIMULATION_DISCLAIMER` from `src/features/coordinator/types.ts` to ensure safe sharing between client components and unit test runners.

## Artifact Index
- `supabase/migrations/20261030000003_m3_m4_approvals_reminders.sql` — PostgreSQL DDL with 11 tables, 100% RLS, and 4 transactional RPCs
- `src/features/approvals/` — Proposal creation, Dept Head review/approval, diff viewer, approvals queue
- `src/features/reminders/` — ReminderScheduleStrategy, +2/+4 overdue engine in Asia/Kolkata, SKIP LOCKED worker
- `src/app/api/cron/process-reminders/route.ts` — CRON_SECRET authenticated cron route handler
- `src/features/coordinator/` — My Tasks queue, simulated send action, mandatory disclaimer, outcome recording
- `tests/unit/approvals-and-coordinator.test.ts` — Comprehensive unit test suite for approvals, coordinator, and disclaimer

## Change Tracker
- **Files modified**:
  - `supabase/migrations/20261030000003_m3_m4_approvals_reminders.sql` — Created migration with 11 tables, RLS, and 4 ACID RPCs
  - `src/features/approvals/types.ts` — Defined approvals contracts
  - `src/features/approvals/schemas.ts` — Defined Zod schemas for correction requests & decisions
  - `src/features/approvals/actions.ts` — Implemented server actions for proposal creation, approval, and rejection
  - `src/features/approvals/components/diff-viewer.tsx` — Created visual diff viewer
  - `src/features/approvals/components/approval-decision-dialog.tsx` — Created decision dialog
  - `src/features/approvals/components/correction-request-form.tsx` — Created proposal submission form
  - `src/features/approvals/components/approvals-queue.tsx` — Created Department Head approvals queue
  - `src/features/approvals/index.ts` — Barrel exports for approvals
  - `src/features/reminders/types.ts` — Defined reminder engine types
  - `src/features/reminders/strategy.ts` — Implemented ReminderScheduleStrategy in needs_configuration
  - `src/features/reminders/overdue-engine.ts` — Implemented confirmed overdue engine in Asia/Kolkata
  - `src/features/reminders/processor.ts` — Implemented SKIP LOCKED queue worker with 3-retry cap
  - `src/features/reminders/actions.ts` — Implemented reminder server actions
  - `src/features/reminders/index.ts` — Barrel exports for reminders
  - `src/app/api/cron/process-reminders/route.ts` — Implemented cron route with CRON_SECRET auth
  - `src/features/coordinator/types.ts` — Defined coordinator task, attempt, and outcome types
  - `src/features/coordinator/schemas.ts` — Defined Zod schemas for coordinator actions
  - `src/features/coordinator/actions.ts` — Implemented coordinator server actions
  - `src/features/coordinator/components/task-priority-badge.tsx` — Created priority badge
  - `src/features/coordinator/components/simulated-send-dialog.tsx` — Created simulated send dialog with disclaimer
  - `src/features/coordinator/components/outcome-recording-dialog.tsx` — Created outcome recording dialog
  - `src/features/coordinator/components/my-tasks-queue.tsx` — Created priority-ordered My Tasks queue
  - `src/features/coordinator/index.ts` — Barrel exports for coordinator
  - `tests/unit/approvals-and-coordinator.test.ts` — Unit tests for M3/M4 schemas and priority logic
- **Build status**: PASS (All 28 tests passing across 4 suites, 0 TS errors in owned files)
- **Pending issues**: None

## Quality Status
- **Build/test result**: All unit and integration test suites pass (28/28 tests passed)
- **Lint status**: Clean in all owned files
- **Tests added/modified**: `tests/unit/approvals-and-coordinator.test.ts` (10 tests added)

## Loaded Skills
- Source: C:\Users\ASUS\.gemini\config\skills\postgresql\SKILL.md
- Source: C:\Users\ASUS\.gemini\config\skills\database-design\SKILL.md
- Source: C:\Users\ASUS\.gemini\config\skills\nextjs-best-practices\SKILL.md
- Source: C:\Users\ASUS\.gemini\config\skills\react-patterns\SKILL.md
