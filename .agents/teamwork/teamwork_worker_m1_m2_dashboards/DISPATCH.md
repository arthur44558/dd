## 2026-10-30T04:07:52Z
Sender: 554ca597-f10b-4913-a0ea-c197b485d283
Content:
You are a full-stack implementation worker agent (Identity: teamwork_worker).
Your working directory is: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_m1_m2_dashboards\
Context: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_m1_m2_dashboards\context.md
You MUST read:
- The original user request at: c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\ORIGINAL_REQUEST.md
- The project definition at: c:\Users\ASUS\Desktop\Projects\dd\PROJECT.md
- The authoritative specification at: c:\Users\ASUS\Desktop\Projects\dd\HOSPITAL_FOLLOWUP_BUILD_SPEC.md

Armed skills:
- Next.js best practices: C:\Users\ASUS\.gemini\config\skills\nextjs-best-practices\SKILL.md
- React patterns: C:\Users\ASUS\.gemini\config\skills\react-patterns\SKILL.md
- Tailwind patterns: C:\Users\ASUS\.gemini\config\skills\tailwind-patterns\SKILL.md
- GitHub: C:\Users\ASUS\.gemini\config\skills\github\SKILL.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive file ownership:
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

Your task:
1. Implement public pages:
   - `/request-access/page.tsx`: form with Zod validation, returns tracking token.
   - `/request-status/page.tsx`: accepts token, looks up status via SHA-256 token hash (zero email enumeration).
   - `/invite/accept/page.tsx`: password setup and account activation.
2. Implement IT Admin console `/it-admin/page.tsx`:
   - Role-guarded (`it_admin`), review pending requests, approve/reject with reason, invite user via Auth Admin API, list profiles, deactivate account.
3. Implement `src/components/layout/authenticated-shell.tsx`:
   - Role banner, user avatar, Asia/Kolkata timezone indicator, logout, navigation for the active role.
4. Implement all 6 operational role dashboards:
   - `/reception/page.tsx`: patient check-in, search, arrivals (ZERO clinical notes displayed).
   - `/assistant/page.tsx`: department intake queue, scan upload trigger, pending doctor review.
   - `/doctor/page.tsx`: my patients, pending reviews, consultation sign-off, correction proposals.
   - `/department-head/page.tsx`: department follow-ups, pending correction approvals, clinical team workload.
   - `/coordinator/page.tsx`: assigned communication tasks, overdue follow-ups, action buttons with disclaimer.
   - `/follow-up-head/page.tsx`: hospital-wide KPI cards, overdue rates, coordinator workload (NO clinical text).
5. Verify `npx tsc --noEmit` succeeds for all your files.
6. Write your handoff report to `c:\Users\ASUS\Desktop\Projects\dd\.agents\teamwork\teamwork_worker_m1_m2_dashboards\handoff.md` and notify parent.

## 2026-10-30T04:25:25Z
Sender: 554ca597-f10b-4913-a0ea-c197b485d283
Content:
**Context**: Worker A Dashboard & Auth Page Implementation
**Content**: All dashboard and auth page files have been created in `src/app/(auth)` and `src/app/(dashboard)`. Please report on current verification status (`npx tsc --noEmit`) and author `handoff.md` to complete your handoff.
**Action**: Run verification, write `handoff.md`, and report back.
