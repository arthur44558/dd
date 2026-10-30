# Milestone 2 Explorer Context
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_explorer_m2_1\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Scope: Milestone 2: Authenticated Shell, Role Dashboards & Patient Registry
1. Authenticated shell: role banner, user info, hospital timezone indicator (Asia/Kolkata), role-based navigation and route guards.
2. 6 Operational Dashboard pages and components:
   - Reception: /reception (quick search, patient check-in, register new patient, today's arrivals; NO clinical details shown)
   - Doctor's Assistant: /assistant (department intake queue, scanned form digitisation, pending doctor review list)
   - Doctor: /doctor (my patients, pending follow-up reviews, submitted consultations, correction requests)
   - Department Head: /department-head (department follow-ups, pending correction approvals, clinical team workload)
   - Follow-up Coordinator: /coordinator (my assigned communication tasks, overdue follow-ups, call/SMS action logs)
   - Follow-up Head: /follow-up-head (hospital-wide follow-up rates, overdue breakdown, coordinator pool metrics; no clinical text)
3. Patient registration & contact subsystem:
   - Tables: patients, patient_contacts, patient_profile_versions, consultations.
   - Registration form with validation (Zod). Support multiple phones, relationship, preferred contact flags, shared contact warning.
   - Deduplication search RPC: search_patients_for_dedup(search_query) checking phone numbers and names, returning match score and disambiguation data.
   - Default-deny RLS policies on all patient tables.

Deliver comprehensive file-by-file blueprint in analysis.md and handoff.md.
