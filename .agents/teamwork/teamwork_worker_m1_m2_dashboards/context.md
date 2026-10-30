# Worker A Context: Auth, Public Pages & Dashboards
Working directory: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_m1_m2_dashboards\
Original Request: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
Specification: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md
Project Definition: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md

Exclusive File Ownership:
- `src/app/(auth)/request-access/page.tsx`
- `src/app/(auth)/request-status/page.tsx`
- `src/app/(auth)/invite/accept/page.tsx`
- `src/app/(dashboard)/it-admin/page.tsx`
- `src/components/layout/authenticated-shell.tsx`
- `src/app/(dashboard)/reception/page.tsx`
- `src/app/(dashboard)/assistant/page.tsx`
- `src/app/(dashboard)/doctor/page.tsx`
- `src/app/(dashboard)/department-head/page.tsx`
- `src/app/(dashboard)/coordinator/page.tsx`
- `src/app/(dashboard)/follow-up-head/page.tsx`

Scope:
1. Public /request-access page with React Hook Form + Zod validation, department selector, role selector (clinical roles only), and clear submission response showing the raw tracking token.
2. Public /request-status page: accepts raw tracking token, checks status via secure SHA-256 hash lookup (zero email enumeration).
3. /invite/accept page: password creation and account activation for invited users.
4. /it-admin console: review pending access requests, approve/reject with reason, invite user via Auth Admin API, list active/deactivated profiles, deactivate account.
5. Authenticated shell: role banner, user avatar, Asia/Kolkata timezone indicator, logout button, and role-based navigation.
6. 6 Role Dashboards:
   - Reception: quick patient check-in, search, arrivals list (ZERO clinical notes visible)
   - Assistant: department intake queue, scan upload trigger, pending doctor review
   - Doctor: patient follow-ups, pending reviews, consultation sign-offs, correction requests
   - Department Head: department follow-ups, pending correction approvals, clinical workload
   - Follow-up Coordinator: assigned communication tasks, overdue follow-ups, action buttons
   - Follow-up Head: high-level KPI cards, overdue rates, coordinator workload (NO clinical text)
