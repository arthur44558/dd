# Worker C Context: Approvals Governance, Reminder Engine & Queue Processor
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_approvals_reminders\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Exclusive File Ownership:
- `src/features/approvals/` (correction proposal creation, version locking, Dept Head approval transaction)
- `src/features/reminders/` (ReminderScheduleStrategy in needs_configuration, +2/+4 overdue logic in Asia/Kolkata)
- `src/app/api/cron/process-reminders/route.ts` (SKIP LOCKED worker, max 3 retries, CRON_SECRET auth)
- `src/features/coordinator/` (task queue, simulated send action with disclaimer, outcome recording)
- `supabase/migrations/20261030000003_m3_m4_approvals_reminders.sql`

Scope:
1. SQL Migration `20261030000003_m3_m4_approvals_reminders.sql`:
   - Tables: `correction_requests`, `correction_request_items`, `approval_decisions`, `schedule_configs`, `reminder_schedules`, `reminder_jobs`, `communication_tasks`, `communication_attempts`, `coordinator_assignments`, `coordinator_workload_events`, `follow_up_outcomes`.
   - 100% default-deny RLS.
2. Correction Governance & Approval Transaction (`src/features/approvals/`):
   - Proposal creation: base_version, reason, proposed changes.
   - Department Head approval RPC/action: ACID transaction with `FOR UPDATE` row lock, verifies base_version == current_version, applies changes, increments current_version, snapshots in `follow_up_versions`, invalidates stale competing proposals, cancels unsent jobs from superseded schedule, and writes audit event.
   - Rejection action with required reason.
3. Reminder & Overdue Engine (`src/features/reminders/`):
   - `ReminderScheduleStrategy` interface in `needs_configuration` state.
   - Confirmed overdue engine: transitions follow-up to `OVERDUE` when appointment date has passed; generates exactly two text tasks (+2 and +4 calendar days in hospital timezone `Asia/Kolkata`).
   - Cron route `/api/cron/process-reminders` processing `reminder_jobs` using `FOR UPDATE SKIP LOCKED` and max 3-retry cap.
4. Coordinator Workload & Communication Actions (`src/features/coordinator/`):
   - "My Tasks" queue with priority ordering (severity first, then nearest due date).
   - Simulated communication send recording in `communication_attempts` with `attempt_type = 'manual_simulated_send'`.
   - Mandatory UI disclaimer: "Manually confirmed / simulated — not provider verified".
   - Follow-up outcome recording (completed, patient rescheduled, patient refused, lost to follow-up).
