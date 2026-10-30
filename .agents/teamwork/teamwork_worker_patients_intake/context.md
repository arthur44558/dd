# Worker B Context: Patient Registry, Deduplication & Clinical Intake
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_patients_intake\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Exclusive File Ownership:
- `src/features/patients/` (schemas, server actions, dedup search RPC, components)
- `src/features/follow-ups/` (schemas, server actions, scan upload, doctor review & submit)
- `supabase/migrations/20261030000002_m2_patients_and_intake.sql`

Scope:
1. SQL Migration `20261030000002_m2_patients_and_intake.sql`:
   - Tables: `patients`, `patient_contacts`, `patient_profile_versions`, `consultations`, `follow_ups`, `follow_up_versions`, `source_documents`.
   - 100% default-deny RLS policies.
   - Deduplication RPC `search_patients_for_dedup(p_query, p_phone)`.
2. Patient Registration subsystem (`src/features/patients/`):
   - Zod validation schemas for patient demographic & contact info.
   - Server action for patient registration with deduplication check (matching name, phone, MRN).
   - Multi-phone contact handling with shared contact flag (`is_shared_contact`).
   - Patient search component and registration modal.
3. Clinical Intake & Follow-up creation (`src/features/follow-ups/`):
   - Assistant intake form: doctor selection, appointment date, severity (`routine`, `moderate`, `high`, `critical`), notes.
   - Document upload to private Supabase bucket: client MIME check + server magic-byte verification (PDF, PNG, JPG), SHA-256 content hashing stored in `source_documents`, short-lived signed URLs (<= 60s).
   - Doctor review & sign-off server action: locks record (`status = 'submitted'`, `current_version = 1`, creates snapshot in `follow_up_versions`).
