## 2026-10-30T03:49:03Z
You are a read-only exploration agent (Identity: teamwork_explorer).
Your working directory is: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m4_1\
You MUST read:
- The original user request at: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
- The project definition at: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md
- The authoritative specification at: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
- Context: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m4_1\context.md

Task: Milestone 4 Blueprint: "Reminder Engine, Overdue Logic & Coordinator Pool"
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

Output requirements:
- Write comprehensive file-by-file implementation guide to c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m4_1\analysis.md
- Write self-contained handoff report to c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m4_1\handoff.md
- Send completion message via send_message to parent once done.

Remember: You are read-only. Do NOT write source code or modify project files outside your designated teamwork folder.
