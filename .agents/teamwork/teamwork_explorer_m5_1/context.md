# Milestone 5 Explorer Context
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m5_1\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Scope: Milestone 5: Contextual Inquiries, Notifications, Audit & Analytics
1. Contextual Clinical Inquiries:
   - Tables: `internal_queries`, `query_messages`.
   - Workflow: Coordinator raises clinical doubt on follow-up record -> Assistant can clarify or escalate to Doctor -> Doctor answers.
   - Tied directly to follow-up context; accessible to involved clinical personnel.
2. Notification Center:
   - Table: `notifications`.
   - Alerts for approvals required, overdue follow-ups, inquiries, task assignments.
   - Bell icon in authenticated header with unread badge and mark-read action.
3. Immutable Audit Logging:
   - Table: `audit_events`.
   - PostgreSQL triggers & server actions logging all record mutations, status changes, access request approvals, logins, and deactivations.
   - Strict default-deny RLS: zero UPDATE or DELETE allowed on `audit_events` by any role.
4. Feature-Flagged AI Form Extraction Adapter:
   - `FormExtractionProvider` interface.
   - `MockFormExtractionProvider` test double providing deterministic extraction when `AI_FORM_EXTRACTION_ENABLED=false`.
   - UI form extraction button disabled or marked test double with warning.
5. Follow-Up Head Analytics Dashboard:
   - High-level KPIs: total follow-ups, completion rate, overdue rate, coordinator workload distribution, department breakdown.
   - Privacy protection: zero patient-identifiable clinical notes exposed on executive dashboard.
6. Database migrations: `internal_queries`, `query_messages`, `notifications`, `audit_events`, `ai_assistance_events` with RLS.

Deliver comprehensive file-by-file blueprint in analysis.md and handoff.md.
