# Milestone 3 Explorer Context
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m3_1\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Scope: Milestone 3: Clinical Intake, Scan Upload & Approval Governance
1. Assistant Clinical Intake:
   - Form fields: patient, doctor, department, visit type, appointment date, severity (routine, moderate, high, critical), follow-up required (boolean), clinical notes.
   - Scan upload: private Supabase storage bucket `source-documents`, client-side MIME check, server magic byte validation (PDF, PNG, JPG), short-lived signed URLs (<= 60s), SHA-256 content hash storage in `source_documents`.
2. Doctor Review & Submission:
   - Doctor queue: view pending assistant drafts, confirm or edit before final submission.
   - Submission locks the record (`status = 'submitted'`, `current_version = 1`, snapshot in `follow_up_versions`).
3. Submitted Record Immutability & Correction Governance:
   - RLS strictly forbids ordinary users from updating submitted `follow_ups` rows.
   - Correction proposal creation: `correction_requests` and `correction_request_items` specifying base_version, reason, proposed field diffs.
4. Department Head Approval Workspace:
   - View pending proposals with side-by-side diff.
   - Approve action: ACID transaction using `FOR UPDATE` row lock, verifies base_version == current_version, applies changes, increments current_version, creates new `follow_up_versions` snapshot, marks competing proposals on older base_version as `stale`, cancels unsent jobs from superseded schedule, and writes audit event.
   - Reject action: requires mandatory rejection reason.
5. Database migrations: `follow_ups`, `follow_up_versions`, `source_documents`, `correction_requests`, `correction_request_items`, `approval_decisions` with RLS.

Deliver comprehensive file-by-file blueprint in analysis.md and handoff.md.
