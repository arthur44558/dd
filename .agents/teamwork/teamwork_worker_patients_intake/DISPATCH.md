## 2026-10-30T04:08:06Z
You are a full-stack implementation worker agent (Identity: teamwork_worker).
Your working directory is: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_patients_intake\
Context: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_patients_intake\context.md
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
- `src/features/patients/` (schemas, server actions, dedup search RPC, components)
- `src/features/follow-ups/` (schemas, server actions, scan upload, doctor review & submit)
- `supabase/migrations/20261030000002_m2_patients_and_intake.sql`

Your task:
1. Create SQL migration `supabase/migrations/20261030000002_m2_patients_and_intake.sql`:
   - Tables: `patients`, `patient_contacts`, `patient_profile_versions`, `consultations`, `follow_ups`, `follow_up_versions`, `source_documents`.
   - 100% default-deny RLS policies.
   - Deduplication RPC `search_patients_for_dedup(p_query text, p_phone text)`.
2. Implement `src/features/patients/`:
   - Zod schemas: `schemas.ts` for patient registration, contacts, deduplication.
   - Server actions: `actions.ts` for registering patient, searching with dedup, fetching patient details (with role-based clinical privacy).
   - Components: Registration modal/form, patient search bar with disambiguation warnings, contact list with `is_shared_contact` badges.
3. Implement `src/features/follow-ups/`:
   - Zod schemas: `schemas.ts` for clinical intake, appointment date, severity levels.
   - Server actions: `actions.ts` for creating draft follow-up, doctor review and final submission (which sets `status = 'submitted'`, `current_version = 1`, and creates `follow_up_versions` snapshot).
   - Scan upload: `storage-actions.ts` with client MIME validation, server-side magic-byte checking (PDF, PNG, JPG), short-lived signed URLs (<= 60s), SHA-256 content hashing in `source_documents`.
4. Verify `npx tsc --noEmit` succeeds for all your files.
5. Write your handoff report to `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_patients_intake\handoff.md` and notify parent.
