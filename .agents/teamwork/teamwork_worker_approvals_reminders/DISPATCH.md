## 2026-10-30T04:08:17Z
You are a full-stack implementation worker agent (Identity: teamwork_worker).
Your working directory is: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_approvals_reminders\
Context: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_approvals_reminders\context.md
You MUST read:
- The original user request at: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
- The project definition at: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md
- The authoritative specification at: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md

Armed skills:
- PostgreSQL: C:\Users\ASUS\.gemini\config\skills\postgresql\SKILL.md
- Database design: C:\Users\ASUS\.gemini\config\skills\database-design\SKILL.md
- Next.js best practices: C:\Users\ASUS\.gemini\config\skills\nextjs-best-practices\SKILL.md
- React patterns: C:\Users\ASUS\.gemini\config\skills\react-patterns\SKILL.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive file ownership:
- `src/features/approvals/` (correction proposal creation, version locking, Dept Head approval transaction)
- `src/features/reminders/` (ReminderScheduleStrategy in needs_configuration, +2/+4 overdue logic in Asia/Kolkata)
- `src/app/api/cron/process-reminders/route.ts` (SKIP LOCKED worker, max 3 retries, CRON_SECRET auth)
- `src/features/coordinator/` (task queue, simulated send action with disclaimer, outcome recording)
- `supabase/migrations/20261030000003_m3_m4_approvals_reminders.sql`

Your task:
1. Create SQL migration `supabase/migrations/20261030000003_m3_m4_approvals_reminders.sql`:
   - Tables: `correction_requests`, `correction_request_items`, `approval_decisions`, `schedule_configs`, `reminder_schedules`, `reminder_jobs`, `communication_tasks`, `communication_attempts`, `coordinator_assignments`, `coordinator_workload_events`, `follow_up_outcomes`.
   - 100% default-deny RLS.
2. Implement `src/features/approvals/`:
   - Correction proposal creation: base_version, reason, proposed change diffs.
   - Dept Head approval server action/RPC: ACID transaction with `FOR UPDATE` row lock, verifies base_version == current_version, applies changes, increments current_version, snapshots into `follow_up_versions`, marks conflicting proposals on older base_version as `stale`, cancels unsent jobs from superseded schedule, and writes audit event.
   - Rejection server action with mandatory rejection reason.
3. Implement `src/features/reminders/`:
   - `ReminderScheduleStrategy` interface defaulting to `needs_configuration` state.
   - Confirmed overdue engine: transitions follow-up to `OVERDUE` when appointment date has passed; generates exactly two overdue text tasks (+2 and +4 calendar days in hospital timezone `Asia/Kolkata`).
   - Cron route `/api/cron/process-reminders/route.ts` with `CRON_SECRET` auth, processing `reminder_jobs` using `FOR UPDATE SKIP LOCKED` and max 3-retry cap.
4. Implement `src/features/coordinator/`:
   - "My Tasks" queue with priority ordering (severity first, then nearest due date).
   - Simulated communication send recording into `communication_attempts` with `attempt_type = 'manual_simulated_send'`.
   - Mandatory UI disclaimer: "Manually confirmed / simulated — not provider verified".
   - Follow-up outcome recording (completed, patient rescheduled, patient refused, lost to follow-up).
5. Verify `npx tsc --noEmit` succeeds for all your files.
6. Write your handoff report to `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_approvals_reminders\handoff.md` and notify parent.
