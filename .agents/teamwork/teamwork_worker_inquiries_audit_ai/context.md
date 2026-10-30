# Worker D Context: Inquiries, Notifications, Audit, AI Mock Adapter & Analytics
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_inquiries_audit_ai\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Exclusive File Ownership:
- `src/features/inquiries/` (Coordinator -> Assistant -> Doctor threads)
- `src/features/notifications/` (in-app alerts, unread counts, mark-read)
- `src/features/audit/` (immutable audit log querying, trigger definitions)
- `src/lib/ai/mock-ai-provider.ts` (deterministic AI extraction adapter)
- `src/features/analytics/` (Follow-up Head privacy-preserving metrics)
- `supabase/migrations/20261030000004_m5_inquiries_notifications_audit.sql`

Scope:
1. SQL Migration `20261030000004_m5_inquiries_notifications_audit.sql`:
   - Tables: `internal_queries`, `query_messages`, `notifications`, `audit_events`, `ai_assistance_events`.
   - Immutable audit trail: zero UPDATE / DELETE allowed on `audit_events` by any application role.
   - 100% default-deny RLS across all tables.
2. Contextual Clinical Inquiries (`src/features/inquiries/`):
   - Internal query creation anchored to a follow-up record.
   - Message posting, status transition (open, answered, closed).
   - Real-time or polling support for inquiry updates.
3. Notification Center (`src/features/notifications/`):
   - In-app notification creation helper (`createNotification()`).
   - Query unread notifications, mark-as-read server action.
   - Header notification bell component.
4. Immutable Audit System (`src/features/audit/`):
   - Server-side domain event logger `logAuditEvent()`.
   - Audit trail viewer component for IT Admin / Dept Head.
5. AI Extraction Adapter (`src/lib/ai/mock-ai-provider.ts`):
   - `FormExtractionProvider` interface.
   - `MockFormExtractionProvider` delivering deterministic extraction without calling external APIs when `AI_FORM_EXTRACTION_ENABLED=false`.
6. Analytics Subsystem (`src/features/analytics/`):
   - KPI calculations for Follow-up Head (total volume, completion rate, overdue rate, coordinator throughput).
   - Strict privacy enforcement: NO clinical notes or patient-identifiable data exposed.
