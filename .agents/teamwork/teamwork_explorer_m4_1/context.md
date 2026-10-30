# Milestone 4 Explorer Context
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m4_1\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Scope: Milestone 4: Reminder Engine, Overdue Logic & Coordinator Pool
1. Pluggable Reminder Scheduling Strategy:
   - `ReminderScheduleStrategy` TypeScript interface.
   - Versioned `schedule_configs` table.
   - Defensive open question handling (OQ-04..06): defaults to `needs_configuration` state, generating zero automatic pre-appointment jobs until configured by admin.
2. Confirmed Overdue Engine:
   - Evaluates active follow-ups where appointment date has passed without resolution.
   - Transitions follow-up to `OVERDUE`.
   - Generates exactly two overdue text tasks: appointment date +2 calendar days, and appointment date +4 calendar days, calculated at hospital midnight in configured timezone `Asia/Kolkata`.
   - Never generates further automatic overdue texts.
3. Durable Reminder Queue & Cron Worker:
   - `reminder_jobs` table: status (`pending`, `processing`, `completed`, `failed`), `scheduled_for`, `retry_count <= 3`, `locked_at`, `locked_by`.
   - Processing logic with `FOR UPDATE SKIP LOCKED`.
   - Route handler `/api/cron/process-reminders` protected with `CRON_SECRET`.
4. Coordinator Workload Pool & Simulated Communications:
   - "My Tasks" queue with priority ordering (critical/high severity first, then nearest due date).
   - Communication action execution: simulated send action recording into `communication_attempts` with `attempt_type = 'manual_simulated_send'`.
   - Mandatory UI and history disclaimer: "Manually confirmed / simulated — not provider verified".
   - Follow-up outcome recording: completed, patient rescheduled, patient refused, lost to follow-up.
5. Database migrations: `schedule_configs`, `reminder_schedules`, `reminder_jobs`, `communication_tasks`, `communication_attempts`, `coordinator_assignments`, `coordinator_workload_events`, `follow_up_outcomes` with RLS.

Deliver comprehensive file-by-file blueprint in analysis.md and handoff.md.
