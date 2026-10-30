# Project: Hospital Follow-Up Continuity System

## Architecture
- **Paradigm**: Modular Monolith on Next.js 15 App Router (TypeScript strict mode).
- **Frontend & Styling**: Tailwind CSS v4 + shadcn/ui components + Lucide React icons.
- **Form Handling & Validation**: React Hook Form + Zod domain schemas.
- **Backend & Services**: Next.js Server Actions & Route Handlers (`src/features/*/services`).
- **Data & Identity**: Supabase PostgreSQL with 100% Row-Level Security (default-deny), Supabase Auth (`@supabase/ssr` server, client, and admin helpers), Supabase Storage (private buckets with short-lived signed URLs <= 60s).
- **Background Jobs**: Supabase Cron (`pg_cron`) / Route Handler `/api/cron/process-reminders` with `FOR UPDATE SKIP LOCKED` and max 3-retry cap.
- **Defensive Design for Open Decisions (OQ-01..16)**: Strategy interfaces (`ReminderScheduleStrategy`, `AssignmentStrategy`, `FormExtractionProvider`) defaulting to `needs_configuration` state without unapproved hardcoded heuristics.
- **Target Repository**: `https://github.com/arthur44558/dd` on branch `main`.

## Code Layout
```
c:\Users\ASUS\Desktop\Projects\dd\
├── src/
│   ├── app/                      # Next.js App Router routes & layouts
│   │   ├── (auth)/               # Public auth & request-access pages
│   │   ├── (dashboard)/          # Authenticated role-specific dashboards
│   │   │   ├── reception/        # Reception Dashboard
│   │   │   ├── assistant/        # Doctor's Assistant Dashboard
│   │   │   ├── doctor/           # Doctor Dashboard
│   │   │   ├── department-head/  # Department Head Dashboard
│   │   │   ├── coordinator/      # Follow-up Coordinator Dashboard
│   │   │   ├── follow-up-head/   # Follow-up Head Dashboard
│   │   │   └── it-admin/         # Privileged IT Admin Console
│   │   ├── api/                  # API route handlers & cron endpoints
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Public landing page
│   ├── components/               # Shared UI & Layout components
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── layout/               # Authenticated shell, header, nav, role banner
│   │   └── shared/               # Reusable dialogs, tables, status badges
│   ├── features/                 # Modular domain slices
│   │   ├── auth/                 # Identity, account requests, profiles, RLS
│   │   ├── patients/             # Patient registration, deduplication, contacts
│   │   ├── follow-ups/           # Follow-up records, versioning, storage scans
│   │   ├── approvals/            # Correction proposals, version locking, reviews
│   │   ├── reminders/            # Scheduler strategy, overdue logic, reminder jobs
│   │   ├── coordinator/          # Workload pool, task queue, simulated sends
│   │   ├── inquiries/            # Contextual inquiries & notification center
│   │   └── audit/                # Immutable audit logging & compliance
│   ├── lib/                      # Core infrastructure utilities
│   │   ├── supabase/             # client.ts, server.ts, admin.ts
│   │   ├── utils/                # Date/time (Asia/Kolkata), phone normalization
│   │   └── ai/                   # AI extraction strategy & test double
│   └── types/                    # Shared TypeScript domain contracts & DB types
├── supabase/
│   ├── migrations/               # PostgreSQL DDL migrations with RLS policies
│   ├── seed.sql                  # Synthetic test data for all roles & clinical cases
│   └── tests/                    # pgTAP / SQL-level RLS verification tests
├── tests/
│   ├── unit/                     # Vitest domain service & validation unit tests
│   ├── integration/              # Vitest API route & database integration tests
│   └── e2e/                      # Playwright end-to-end user journey tests
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── .env.example
└── README.md
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Project Scaffolding & Git Remote | Next.js App Router, Tailwind, TypeScript, ESLint, Git setup to arthur44558/dd | M1 | Spec §2, §15 |
| 2 | Supabase Multi-Client Setup | SSR browser, server, and service-role admin clients | M1 | Spec §2.3, §8 |
| 3 | Public Access Request Workflow | Public form `/request-access`, status tracking `/request-status`, hashed tokens | M1 | Spec §3.1, §3.3 |
| 4 | IT Admin Account Management | IT Console `/it-admin`, request review, Auth admin invite, account deactivation | M1 | Spec §3.2, §4.8 |
| 5 | Role-Based Authenticated Shell | Shared nav, role banner, user avatar, Asia/Kolkata timezone indicator | M2 | Spec §4.1, §2.2 |
| 6 | 6 Operational Dashboard Skeletons | Dashboards for Reception, Assistant, Doctor, Dept Head, Coordinator, Follow-up Head | M2 | Spec §4 |
| 7 | Patient Registration & Contact Management | Registration form, multi-phone contact support, preferred contact flags | M2 | Spec §5.1, §7.1 |
| 8 | Patient Deduplication Search RPC | Search by phone, name, MRN with disambiguation warnings | M2 | Spec §5.1 |
| 9 | Assistant Clinical Intake & Scan Upload | Manual form digitisation, visit type, doctor selection, scan upload to private bucket | M3 | Spec §5.2, §8.6 |
| 10 | Doctor Review & Submission | Doctor intake verification, clinical confirmation, final submission | M3 | Spec §5.2 |
| 11 | Submitted Record Immutability | RLS locking direct updates on submitted follow-ups | M3 | Spec §5.3, §7.4 |
| 12 | Correction Request & Version Governance | Correction proposal creation, items breakdown, change reason | M3 | Spec §5.3, §7.4 |
| 13 | Department Head Approval Workspace | Side-by-side diff view, atomic approval transaction (`FOR UPDATE`), version snapshot | M3 | Spec §4.5, §5.3 |
| 14 | Stale Proposal Handling | Automated invalidation/flagging of competing proposals when base version advances | M3 | Spec §5.3, §7.4 |
| 15 | Pluggable Reminder Schedule Strategy | `ReminderScheduleStrategy` interface in `needs_configuration` state | M4 | Spec §6.1, §6.2 |
| 16 | Confirmed Overdue Engine | +2 and +4 calendar days overdue text tasks generated in `Asia/Kolkata` timezone | M4 | Spec §6.3 |
| 17 | Reliable Reminder Queue & Cron Worker | `reminder_jobs` table, `FOR UPDATE SKIP LOCKED`, max 3-retry cap, `/api/cron/process-reminders` | M4 | Spec §6.4 |
| 18 | Coordinator Task Queue & Simulated Sends | "My Tasks" queue, manual confirmation action with mandatory simulation disclaimer | M4 | Spec §4.6, §6.5 |
| 19 | Follow-up Outcome Recording | Patient contact resolution, reschedule, refusal, lost to follow-up | M4 | Spec §6.5, §7.1 |
| 20 | Contextual Clinical Inquiries | Threads from Coordinator -> Assistant -> Doctor anchored to follow-up record | M5 | Spec §4.6, §7.1 |
| 21 | Notification Center | Real-time / polling alerts for approvals, overdue tasks, inquiry messages | M5 | Spec §7.1 |
| 22 | Immutable Audit Logging | Triggers and domain RPCs capturing all role actions into `audit_events` | M5 | Spec §8.7 |
| 23 | Feature-Flagged AI Extraction Adapter | `FormExtractionProvider` interface with `MockFormExtractionProvider` test double | M5 | Spec §9 |
| 24 | Follow-up Head Analytics Dashboard | Operational throughput metrics, overdue rates, without exposing clinical text | M5 | Spec §4.7 |
| 25 | E2E Testing Suite (Tiers 1-4) | Comprehensive test suite covering all roles, edge cases, races, and 13-step scenario | M6 | Spec §14, §17 |
| 26 | Adversarial Hardening (Tier 5) | White-box stress testing, IDOR injection, permission escalation, RLS audit | M6 | Spec §14.6 |
| 27 | Full Build Verification & Remote Git Push | Clean lint, strict typecheck, unit + E2E pass, build pass, push to GitHub | M6 | Spec §15, Original Request |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation, Git Setup & Access Request Workflow | Scaffolding, Git remote, Supabase client setup, Public Request Access, IT Admin Console, Auth invite | none | DONE |
| M2 | Authenticated Shell, Role Dashboards & Patient Registry | Authenticated shell, 6 role dashboards, Patient registration, deduplication search RPC, contacts | M1 | DONE |
| M3 | Clinical Intake, Scan Upload & Approval Governance | Assistant intake, scan upload, doctor review, immutability, correction proposals, Dept Head approval | M2 | DONE |
| M4 | Reminder Engine, Overdue Logic & Coordinator Pool | Scheduler strategy, +2/+4 overdue engine, cron worker, Coordinator tasks, simulated sends, outcomes | M3 | DONE |
| M5 | Inquiries, Notifications, Audit & Analytics | Contextual inquiries, notification center, immutable audit trail, AI adapter, Follow-up Head metrics | M4 | DONE |
| M6 | E2E Test Suite Pass, Hardening, Build & Git Push | 100% E2E test pass (Tiers 1-4, Section 17 demo), Tier 5 hardening, build verification, Git push | M5, TEST_READY | DONE |

## Interface Contracts
### Auth & Identity Contract (`src/features/auth`)
```typescript
export type UserRole = 'reception' | 'assistant' | 'doctor' | 'department_head' | 'coordinator' | 'follow_up_head' | 'it_admin';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'invited' | 'active' | 'deactivated';

export interface UserProfile {
  id: string; // Supabase auth.users UUID
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string | null;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequestPayload {
  fullName: string;
  email: string;
  phone: string;
  requestedRole: UserRole;
  departmentId?: string;
  justification: string;
}
```

### Patient & Clinical Records Contract (`src/features/patients`, `src/features/follow-ups`)
```typescript
export interface PatientSummary {
  id: string;
  mrn: string;
  fullName: string;
  dob: string;
  gender: string;
  primaryPhone: string;
  isSharedContact: boolean;
}

export type FollowUpStatus = 'draft' | 'submitted' | 'active' | 'overdue' | 'completed' | 'cancelled';

export interface FollowUpRecord {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string; // YYYY-MM-DD
  severity: 'routine' | 'moderate' | 'high' | 'critical';
  status: FollowUpStatus;
  currentVersion: number;
  notes?: string;
}
```

### Correction & Approval Governance Contract (`src/features/approvals`)
```typescript
export interface CorrectionProposalPayload {
  followUpId: string;
  baseVersion: number;
  reason: string;
  proposedChanges: {
    appointmentDate?: string;
    severity?: string;
    notes?: string;
  };
}

export interface ApprovalDecisionPayload {
  correctionRequestId: string;
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
}
```

### Reminders & Queue Processing Contract (`src/features/reminders`)
```typescript
export interface ReminderScheduleStrategy {
  generateSchedule(followUp: FollowUpRecord): {
    strategyName: string;
    isConfigured: boolean;
    jobs: Array<{
      scheduledFor: string; // ISO date-time
      channel: 'sms' | 'call';
      priority: number;
    }>;
  };
}
```
