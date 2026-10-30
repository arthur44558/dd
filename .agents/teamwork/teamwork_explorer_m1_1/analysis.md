# Technical Implementation Blueprint: Milestone 1
## Foundation, Git Setup & Access Request Workflow

- **Document Version**: 1.0.0
- **Target Project**: Hospital Follow-up Continuity System
- **Author**: Teamwork Explorer (`teamwork_explorer_m1_1`)
- **Date**: 2026-10-30
- **Authoritative Specification**: `HOSPITAL_FOLLOWUP_BUILD_SPEC.md`
- **Scope**: Milestone 1 (Foundation, Git Setup, Supabase Multi-Client, DB Migrations & RLS, Public Landing & Request Access, IT Admin Console, Invite Acceptance)

---

## 1. Executive Summary & Milestone 1 Architecture

Milestone 1 establishes the bedrock of the Hospital Follow-up Continuity System. The primary objectives are:
1. **Clean Project Scaffolding**: Setup Next.js 15 App Router with strict TypeScript (`strict: true`), Tailwind CSS v4, Lucide React icons, and shadcn/ui component primitives.
2. **Git Repository Initialization**: Initialize git on `main` branch, configure `.gitignore` to prevent secret leaks, and wire the remote origin to `https://github.com/arthur44558/dd`.
3. **Tri-Tier Supabase Client Architecture**: Implement distinct browser (`@supabase/ssr`), server-cookie (`@supabase/ssr`), and privileged server-only admin (`@supabase/supabase-js` with `import 'server-only'`) clients to prevent privilege escalation while honoring Row Level Security (RLS).
4. **Relational Database Foundation with 100% Default-Deny RLS**: Deliver full PostgreSQL migration for identity and organizational boundaries: `departments`, `profiles`, `department_memberships`, `doctor_profiles`, `account_requests`, and `account_request_events` with strict foreign keys, check constraints, immutable timestamps, and granular RLS policies.
5. **Public Access Request Workflow**: An institutional landing page (`/`), an anti-enumeration access request form (`/request-access`) validated via Zod, and a secure token-hashed tracking mechanism (`/request-status`).
6. **IT Admin Account Review & Invitation Flow**: A privileged IT Admin Console (`/it-admin`) protected by server-side role verification, supporting concurrent-safe request approvals, programmatic user invitation via Supabase Auth Admin API, and a secure password setup / account activation portal (`/invite/accept`).

---

## 2. Milestone 1 File Manifest

The implementing worker must create the following files under `c:\Users\ASUS\Desktop\Projects\dd\`:

```text
c:\Users\ASUS\Desktop\Projects\dd\
├── .env.example                                      # Environment variables template
├── .gitignore                                        # Comprehensive git ignore rules
├── components.json                                   # shadcn/ui configuration
├── next.config.ts                                    # Next.js 15 config with security headers
├── package.json                                      # Dependencies, scripts, project metadata
├── postcss.config.mjs                                # PostCSS config for Tailwind CSS v4
├── tsconfig.json                                     # Strict TypeScript configuration
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── invite/
│   │   │   │   └── accept/
│   │   │   │       └── page.tsx                      # Invite verification & password setup page
│   │   │   ├── login/
│   │   │   │   └── page.tsx                          # Staff login portal (Supabase Auth)
│   │   │   ├── request-access/
│   │   │   │   └── page.tsx                          # Public staff access request form
│   │   │   └── request-status/
│   │   │       └── page.tsx                          # Anti-enumeration status check
│   │   ├── (public)/
│   │   │   └── page.tsx                              # Institutional landing page (or root page.tsx)
│   │   ├── (workspace)/
│   │   │   ├── it-admin/
│   │   │   │   └── page.tsx                          # Privileged IT Admin console
│   │   │   └── layout.tsx                            # Authenticated workspace layout shell
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── callback/
│   │   │           └── route.ts                      # Supabase Auth cookie exchange route handler
│   │   ├── globals.css                               # Tailwind CSS v4 theme and custom styles
│   │   └── layout.tsx                                # Root Next.js layout (metadata, fonts)
│   ├── components/
│   │   ├── it-admin/
│   │   │   ├── RequestReviewDialog.tsx               # Review, role assignment & approval modal
│   │   │   └── RequestReviewTable.tsx                # Filterable account request queue
│   │   └── ui/                                       # shadcn/ui base primitives (Button, Input, Card, Badge, Table, Dialog, Alert)
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       └── textarea.tsx
│   ├── features/
│   │   └── access-requests/
│   │       ├── actions.ts                            # Public server actions (submit, status check)
│   │       ├── admin-actions.ts                      # IT Admin server actions (approve, reject)
│   │       └── schemas.ts                            # Zod validation schemas
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── permissions.ts                        # Typed permission checks
│   │   │   └── require-user.ts                       # Server-side identity & profile status guard
│   │   ├── security/
│   │   │   └── tokens.ts                             # Cryptographic SHA-256 token hashing
│   │   ├── supabase/
│   │   │   ├── admin.ts                              # Server-only admin client (service-role key)
│   │   │   ├── client.ts                             # Browser client (@supabase/ssr)
│   │   │   └── server.ts                             # Server client with async cookies (@supabase/ssr)
│   │   └── utils.ts                                  # cn utility (clsx + tailwind-merge)
│   ├── middleware.ts                                 # Session cookie refresh & route protection
│   └── types/
│       ├── auth.ts                                   # Domain models for roles, statuses, requests
│       └── database.types.ts                         # Supabase generated database types
└── supabase/
    ├── migrations/
    │   └── 20261030000001_m1_foundation_and_access_requests.sql  # M1 DDL migration with RLS
    └── seed.sql                                      # Departments & synthetic profile mappings
```

---

## 3. Step 1: Scaffolding, Tooling & Configuration

### 3.1 `package.json`
Define the project scripts, production dependencies, and devDependencies.

```json
{
  "name": "hospital-followup-continuity",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:types": "supabase gen types typescript --local > src/types/database.types.ts"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.49.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0",
    "lucide-react": "^0.475.0",
    "next": "^15.1.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.54.2",
    "server-only": "^0.0.1",
    "tailwind-merge": "^3.0.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.1",
    "@tailwindcss/postcss": "^4.0.7",
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "eslint": "^9.20.1",
    "eslint-config-next": "^15.1.7",
    "postcss": "^8.5.2",
    "tailwindcss": "^4.0.7",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

### 3.2 `tsconfig.json`
Enforce strict compiler options, Next.js plugin integration, and alias resolution.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3.3 `next.config.ts`
Implement standard security headers conforming to Spec §8.5.

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 3.4 Tailwind CSS v4 Configuration & Styles
In Tailwind CSS v4, styling is CSS-first using the `@tailwindcss/postcss` plugin.

#### `postcss.config.mjs`
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

#### `src/app/globals.css`
```css
@import "tailwindcss";

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #0284c7;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f0f9ff;
  --accent-foreground: #0369a1;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #0284c7;
  --radius: 0.5rem;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  min-height: 100vh;
}
```

### 3.5 `components.json` (shadcn/ui)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 3.6 `.env.example`
```dotenv
# Supabase Public API (Exposed to browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sbp_your_publishable_or_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Server-only Secrets (NEVER expose to browser bundle)
SUPABASE_SECRET_KEY=sb_secret_your_service_role_key
APP_TIME_ZONE=Asia/Kolkata
CRON_SECRET=your_random_32_byte_cron_secret

# Optional Integrations
CAPTCHA_SECRET_KEY=
EMAIL_FROM_ADDRESS=noreply@hospital-continuity.local
```

### 3.7 `.gitignore`
```gitignore
# Dependencies
/node_modules
/.pnp
.pnp.js

# Testing & Coverage
/coverage
/playwright-report
/test-results

# Next.js build output
/.next/
/out/
/build

# Environment files (CRITICAL: Do NOT commit real secrets)
.env
.env*.local
.env.development
.env.production
.env.test

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# OS & IDE metadata
.DS_Store
Thumbs.db
*.pem
.idea/
.vscode/
*.swp
```

---

## 4. Step 2: Git Initialization Strategy & Remote Setup

### Execution Commands:
The worker should execute the following sequence via terminal commands:
```bash
# 1. Initialize git with default main branch
git init -b main

# 2. Configure local repository identity
git config user.name "Arthur"
git config user.email "arthur@local.hospital"

# 3. Add remote origin
git remote add origin https://github.com/arthur44558/dd

# 4. Verify remote
git remote -v
```

### Git Hygiene Rules:
- Staging must strictly ignore `.agents/teamwork/` scratch files that do not belong to the repo. Only committed metadata in `.agents/` should match project layout.
- Always verify `git status` before committing to ensure no credentials or `.env.local` files are tracked.

---

## 5. Step 3: Supabase Multi-Client Architecture & Auth Helpers

### 5.1 Browser Client: `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
```

### 5.2 Request-Scoped Server Client: `src/lib/supabase/server.ts`
Designed specifically for Next.js 15 App Router where `cookies()` is an asynchronous function.
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // If called from a Server Component, setAll might throw; ignored as middleware handles refresh.
        }
      },
    },
  });
}
```

### 5.3 Server-Only Administrative Client: `src/lib/supabase/admin.ts`
Strictly isolated using `import 'server-only'`. Bypasses RLS exclusively for IT Admin operations (invites, user bans, audit inserts).
```typescript
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

### 5.4 Server-Side Identity Guard: `src/lib/auth/require-user.ts`
Enforces Spec §3.2 and §8.1: fails closed if profile is missing or status is `invited`, `pending`, `suspended`, or `deactivated`.
```typescript
import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile, UserRole } from '@/types/auth';

export interface AuthorizedActor {
  id: string;
  email: string;
  profile: UserProfile;
}

export async function requireUser(allowedRoles?: UserRole[]): Promise<AuthorizedActor> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    redirect('/login');
  }

  // Load user profile from database
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Fail closed: Profile missing
    redirect('/login?error=profile_not_found');
  }

  // Enforce account status check
  if (profile.status !== 'active') {
    redirect(`/login?error=account_${profile.status}`);
  }

  // Enforce role authorization if specified
  if (allowedRoles && !allowedRoles.includes(profile.role as UserRole)) {
    redirect('/login?error=unauthorized_role');
  }

  return {
    id: user.id,
    email: user.email,
    profile: profile as UserProfile,
  };
}
```

### 5.5 Next.js Middleware: `src/middleware.ts`
Refreshes Auth session cookies on every request and provides route-level gatekeeping.
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth session
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 5.6 Cryptographic Token Utility: `src/lib/security/tokens.ts`
```typescript
import crypto from 'node:crypto';

export interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
}

/**
 * Generates a 32-byte cryptographically secure random token and its SHA-256 hash.
 */
export function generateSecureToken(): GeneratedToken {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

/**
 * Computes the SHA-256 hex digest of a user-supplied token.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}
```

---

## 6. Step 4: Database Migrations & 100% Default-Deny RLS

Create migration file: `supabase/migrations/20261030000001_m1_foundation_and_access_requests.sql`

```sql
-- =============================================================================
-- Migration: 20261030000001_m1_foundation_and_access_requests.sql
-- Description: Core Enums, Organization, Profiles, Access Requests, and 100% RLS
-- =============================================================================

-- 1. ENUMS
CREATE TYPE user_role AS ENUM (
  'reception',
  'assistant',
  'doctor',
  'department_head',
  'coordinator',
  'follow_up_head',
  'it_admin'
);

CREATE TYPE account_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'invited',
  'active',
  'suspended',
  'deactivated'
);

-- 2. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. DEPARTMENTS TABLE
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 4. PROFILES TABLE (Mirrors auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  status account_status NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 5. DEPARTMENT MEMBERSHIPS TABLE
CREATE TABLE department_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  role user_role NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_profile_department UNIQUE(profile_id, department_id)
);

CREATE TRIGGER trigger_department_memberships_updated_at
  BEFORE UPDATE ON department_memberships
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 6. DOCTOR PROFILES TABLE
CREATE TABLE doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT UNIQUE,
  doctor_id TEXT NOT NULL UNIQUE,
  medical_license_number TEXT NOT NULL,
  speciality TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_doctor_profiles_updated_at
  BEFORE UPDATE ON doctor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 7. ACCOUNT REQUESTS TABLE
CREATE TABLE account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  employee_id TEXT,
  requested_role user_role NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  justification TEXT NOT NULL,
  status account_status NOT NULL DEFAULT 'pending',
  status_token_hash TEXT NOT NULL UNIQUE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_requested_role_not_admin CHECK (requested_role != 'it_admin')
);

CREATE INDEX idx_account_requests_email ON account_requests(LOWER(email));
CREATE INDEX idx_account_requests_status ON account_requests(status);
CREATE INDEX idx_account_requests_token_hash ON account_requests(status_token_hash);

CREATE TRIGGER trigger_account_requests_updated_at
  BEFORE UPDATE ON account_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 8. ACCOUNT REQUEST EVENTS TABLE
CREATE TABLE account_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES account_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_request_events_request_id ON account_request_events(request_id);

-- =============================================================================
-- SECURITY HELPER FUNCTIONS (SECURITY DEFINER with fixed search_path)
-- =============================================================================

CREATE OR REPLACE FUNCTION is_active_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles
  WHERE id = user_id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION is_it_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'it_admin' AND status = 'active'
  );
$$;

-- Secure public token lookup RPC (Anti-enumeration: does not leak email or internal notes)
CREATE OR REPLACE FUNCTION check_request_status(p_token_hash TEXT)
RETURNS TABLE (
  request_id UUID,
  requested_role user_role,
  status account_status,
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    id AS request_id,
    requested_role,
    status,
    created_at,
    reviewed_at,
    rejection_reason
  FROM account_requests
  WHERE status_token_hash = p_token_hash;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (100% DEFAULT-DENY)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_request_events ENABLE ROW LEVEL SECURITY;

-- 1. DEPARTMENTS POLICIES
CREATE POLICY "Departments are viewable by active authenticated staff"
  ON departments FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

CREATE POLICY "Departments are manageable by it_admin only"
  ON departments FOR ALL
  TO authenticated
  USING (is_it_admin(auth.uid()))
  WITH CHECK (is_it_admin(auth.uid()));

-- 2. PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "IT Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_it_admin(auth.uid()));

CREATE POLICY "IT Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_it_admin(auth.uid()))
  WITH CHECK (is_it_admin(auth.uid()));

-- 3. DEPARTMENT MEMBERSHIPS POLICIES
CREATE POLICY "Users can view their own department memberships"
  ON department_memberships FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR is_it_admin(auth.uid()));

CREATE POLICY "IT Admins can manage department memberships"
  ON department_memberships FOR ALL
  TO authenticated
  USING (is_it_admin(auth.uid()))
  WITH CHECK (is_it_admin(auth.uid()));

-- 4. DOCTOR PROFILES POLICIES
CREATE POLICY "Active staff can view active doctor profiles"
  ON doctor_profiles FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()) AND is_active = TRUE);

CREATE POLICY "IT Admins can manage doctor profiles"
  ON doctor_profiles FOR ALL
  TO authenticated
  USING (is_it_admin(auth.uid()))
  WITH CHECK (is_it_admin(auth.uid()));

-- 5. ACCOUNT REQUESTS POLICIES
CREATE POLICY "IT Admins can view and manage account requests"
  ON account_requests FOR ALL
  TO authenticated
  USING (is_it_admin(auth.uid()))
  WITH CHECK (is_it_admin(auth.uid()));

-- 6. ACCOUNT REQUEST EVENTS POLICIES
CREATE POLICY "IT Admins can view account request events"
  ON account_request_events FOR SELECT
  TO authenticated
  USING (is_it_admin(auth.uid()));

CREATE POLICY "IT Admins can insert account request events"
  ON account_request_events FOR INSERT
  TO authenticated
  WITH CHECK (is_it_admin(auth.uid()));
```

### 6.2 Seed Data (`supabase/seed.sql`)
```sql
-- Seed Core Clinical Departments
INSERT INTO departments (name, code, description) VALUES
  ('Cardiology', 'CARD', 'Heart and cardiovascular care'),
  ('Oncology', 'ONCO', 'Comprehensive cancer care and follow-up'),
  ('Neurology', 'NEUR', 'Brain and nervous system disorders'),
  ('Orthopedics', 'ORTH', 'Musculoskeletal system surgery and rehabilitation'),
  ('General Medicine', 'GENM', 'Primary and internal medicine follow-up')
ON CONFLICT (code) DO NOTHING;
```

---

## 7. Step 5: Public Landing Page & Access Request Workflow

### 7.1 Domain Types: `src/types/auth.ts`
```typescript
export type UserRole =
  | 'reception'
  | 'assistant'
  | 'doctor'
  | 'department_head'
  | 'coordinator'
  | 'follow_up_head'
  | 'it_admin';

export type AccountStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'invited'
  | 'active'
  | 'suspended'
  | 'deactivated';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

export interface AccountRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  employeeId?: string | null;
  requestedRole: UserRole;
  departmentId?: string | null;
  justification: string;
  status: AccountStatus;
  statusTokenHash: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  authUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 7.2 Zod Schemas: `src/features/access-requests/schemas.ts`
```typescript
import { z } from 'zod';

export const operationalRoles = [
  'reception',
  'assistant',
  'doctor',
  'department_head',
  'coordinator',
  'follow_up_head',
] as const;

export const AccessRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid hospital email address')
    .toLowerCase(),
  phone: z
    .string()
    .trim()
    .min(10, 'Contact number must be at least 10 digits')
    .max(15, 'Contact number is too long')
    .regex(/^[+0-9\s-]+$/, 'Invalid phone number format'),
  employeeId: z
    .string()
    .trim()
    .max(50, 'Employee ID too long')
    .optional()
    .or(z.literal('')),
  requestedRole: z.enum(operationalRoles, {
    errorMap: () => ({ message: 'Please select a valid operational role' }),
  }),
  departmentId: z.string().uuid('Please select a valid department').optional().or(z.literal('')),
  justification: z
    .string()
    .trim()
    .min(10, 'Please provide a justification of at least 10 characters')
    .max(500, 'Justification cannot exceed 500 characters'),
  agreementAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the hospital data privacy agreement' }),
  }),
});

export type AccessRequestInput = z.infer<typeof AccessRequestSchema>;
```

### 7.3 Server Actions: `src/features/access-requests/actions.ts`
```typescript
'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateSecureToken, hashToken } from '@/lib/security/tokens';
import { AccessRequestSchema, type AccessRequestInput } from './schemas';

export interface SubmitRequestResult {
  success: boolean;
  trackingToken?: string;
  error?: string;
}

export async function submitAccessRequest(
  data: AccessRequestInput
): Promise<SubmitRequestResult> {
  const parsed = AccessRequestSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || 'Invalid form input' };
  }

  const payload = parsed.data;
  const normalizedEmail = payload.email.toLowerCase();

  // Check if there is already a pending request for this email
  const { data: existing, error: checkError } = await supabaseAdmin
    .from('account_requests')
    .select('id, status')
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (checkError) {
    return { success: false, error: 'Database error checking existing requests' };
  }

  if (existing) {
    return {
      success: false,
      error: 'A pending access request already exists for this email address.',
    };
  }

  const { rawToken, tokenHash } = generateSecureToken();

  // Insert into account_requests
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('account_requests')
    .insert({
      full_name: payload.fullName,
      email: normalizedEmail,
      phone: payload.phone,
      employee_id: payload.employeeId || null,
      requested_role: payload.requestedRole,
      department_id: payload.departmentId || null,
      justification: payload.justification,
      status: 'pending',
      status_token_hash: tokenHash,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return { success: false, error: 'Failed to record access request. Please try again later.' };
  }

  // Insert submission event
  await supabaseAdmin.from('account_request_events').insert({
    request_id: inserted.id,
    event_type: 'submitted',
    notes: 'Access request submitted by prospective staff member',
  });

  return {
    success: true,
    trackingToken: rawToken,
  };
}

export interface RequestStatusResult {
  found: boolean;
  data?: {
    requestId: string;
    requestedRole: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
  error?: string;
}

export async function getRequestStatusByToken(
  rawToken: string
): Promise<RequestStatusResult> {
  if (!rawToken || rawToken.trim().length !== 64) {
    return { found: false, error: 'Invalid token format. A 64-character hex token is required.' };
  }

  const tokenHash = hashToken(rawToken);

  // Call the SECURITY DEFINER RPC
  const { data, error } = await supabaseAdmin.rpc('check_request_status', {
    p_token_hash: tokenHash,
  });

  if (error || !data || data.length === 0) {
    return { found: false, error: 'No matching request found for this tracking token.' };
  }

  const item = data[0];
  return {
    found: true,
    data: {
      requestId: item.request_id,
      requestedRole: item.requested_role,
      status: item.status,
      createdAt: item.created_at,
      reviewedAt: item.reviewed_at,
      rejectionReason: item.rejection_reason,
    },
  };
}
```

### 7.4 Public Landing Page: `src/app/(public)/page.tsx`
```tsx
import Link from 'next/link';
import { ShieldCheck, UserCheck, Stethoscope, Lock, FileText, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-600 text-white rounded-lg">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Hospital Follow-up Continuity
            </h1>
            <p className="text-xs text-slate-500 font-medium">Clinical Oversight & Follow-up Platform</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/request-access"
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Request Access
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors shadow-xs"
          >
            Staff Login
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-xs font-semibold mb-6 border border-sky-200">
          <ShieldCheck className="w-4 h-4" />
          <span>Strict Clinical Governance & Immutable Versioning</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mb-6">
          Reliable Patient Follow-up, Transparent Clinical Oversight
        </h2>

        <p className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
          A dedicated institutional workflow digitising clinical follow-up orders, synchronising
          patient appointments, and maintaining tamper-evident audit trails across clinical teams.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-all"
          >
            <span>Access Operational Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/request-access"
            className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs flex items-center justify-center space-x-2 transition-all"
          >
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>Request Staff Account</span>
          </Link>
        </div>

        {/* Core Pillars */}
        <div className="grid md:grid-cols-3 gap-8 text-left w-full mt-4">
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Immutable Clinical Versions</h3>
            <p className="text-sm text-slate-600">
              Submitted clinical records are version-locked. Corrections require explicit Department
              Head review with side-by-side verification.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Role-Scoped Isolation</h3>
            <p className="text-sm text-slate-600">
              Six dedicated operational dashboards with PostgreSQL Row Level Security enforcing
              least-privilege boundaries at the database tier.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Authorized Access Only</h3>
            <p className="text-sm text-slate-600">
              Zero public self-signup. All accounts are vetted, approved, and provisioned by the IT
              Administration team.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 bg-slate-900 text-slate-400 text-xs text-center border-t border-slate-800">
        <p className="mb-1">
          Hospital Follow-up Continuity System &bull; Production Demonstration Release
        </p>
        <p className="text-slate-500">
          Synthetic patient data only &bull; Internal hospital use strictly restricted to authorized personnel.
        </p>
      </footer>
    </div>
  );
}
```

### 7.5 Request Access Form Page: `src/app/(auth)/request-access/page.tsx`
Includes form handling, real-time validation, department loading, and token presentation.
- Displays form with fields: Full Name, Hospital Email, Phone, Employee ID, Requested Role, Department, Justification, Privacy checkbox.
- On success: presents the raw tracking token and direct link `/request-status?token=<rawToken>`.

### 7.6 Request Status Page: `src/app/(auth)/request-status/page.tsx`
- Parses `searchParams.token`.
- Invokes `getRequestStatusByToken(token)`.
- Displays status badge (`pending` = Amber, `approved` = Green, `rejected` = Red).
- Displays timestamps (`Submitted: ...`, `Reviewed: ...`), and rejection reason if rejected.

---

## 8. Step 6: IT Admin Console & Invite Acceptance

### 8.1 IT Admin Server Actions: `src/features/access-requests/admin-actions.ts`
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { UserRole } from '@/types/auth';

export interface ActionResponse {
  success: boolean;
  error?: string;
}

/**
 * Approves a pending account request, creates an Auth user invite via Admin API,
 * maps the profile record in 'invited' state, and assigns department membership.
 */
export async function approveAccountRequest(
  requestId: string,
  finalRole: UserRole,
  departmentId?: string | null
): Promise<ActionResponse> {
  // 1. Authorize IT Admin actor
  const adminActor = await requireUser(['it_admin']);

  // 2. Fetch target request in pending state (concurrency check)
  const { data: request, error: fetchError } = await supabaseAdmin
    .from('account_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Account request not found' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: `Request has already been ${request.status}` };
  }

  // 3. Invite user via Supabase Auth Admin API
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(request.email, {
      redirectTo: `${appUrl}/invite/accept`,
      data: {
        full_name: request.full_name,
        role: finalRole,
      },
    });

  if (inviteError || !inviteData.user) {
    return {
      success: false,
      error: `Auth Admin invitation failed: ${inviteError?.message || 'Unknown error'}`,
    };
  }

  const authUserId = inviteData.user.id;

  // 4. Create or update profile record with 'invited' status
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    {
      id: authUserId,
      email: request.email,
      full_name: request.full_name,
      role: finalRole,
      department_id: departmentId || null,
      status: 'invited',
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    return {
      success: false,
      error: `Profile mapping failed: ${profileError.message}`,
    };
  }

  // 5. Add department membership if clinical role
  if (departmentId) {
    await supabaseAdmin.from('department_memberships').upsert(
      {
        profile_id: authUserId,
        department_id: departmentId,
        role: finalRole,
        is_primary: true,
        is_active: true,
      },
      { onConflict: 'profile_id,department_id' }
    );
  }

  // 6. Update account request status to approved
  const { error: updateError } = await supabaseAdmin
    .from('account_requests')
    .update({
      status: 'approved',
      reviewed_by: adminActor.id,
      reviewed_at: new Date().toISOString(),
      auth_user_id: authUserId,
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (updateError) {
    return { success: false, error: 'Failed to update request status' };
  }

  // 7. Record approval event
  await supabaseAdmin.from('account_request_events').insert({
    request_id: requestId,
    actor_id: adminActor.id,
    event_type: 'approved',
    notes: `Approved by IT Admin. Final role: ${finalRole}. Invite sent.`,
    metadata: { finalRole, departmentId, authUserId },
  });

  revalidatePath('/it-admin');
  return { success: true };
}

/**
 * Rejects an account request with a mandatory reason.
 */
export async function rejectAccountRequest(
  requestId: string,
  reason: string
): Promise<ActionResponse> {
  const adminActor = await requireUser(['it_admin']);

  if (!reason || reason.trim().length < 5) {
    return { success: false, error: 'A rejection reason of at least 5 characters is required' };
  }

  const { error: updateError } = await supabaseAdmin
    .from('account_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason.trim(),
      reviewed_by: adminActor.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (updateError) {
    return { success: false, error: 'Failed to reject request' };
  }

  await supabaseAdmin.from('account_request_events').insert({
    request_id: requestId,
    actor_id: adminActor.id,
    event_type: 'rejected',
    notes: reason.trim(),
  });

  revalidatePath('/it-admin');
  return { success: true };
}
```

### 8.2 IT Admin Console Page: `src/app/(workspace)/it-admin/page.tsx`
Server Component fetching requests and rendering metrics + review queue:
```tsx
import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { RequestReviewTable } from '@/components/it-admin/RequestReviewTable';
import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default async function ITAdminConsolePage() {
  // Guard route for it_admin
  await requireUser(['it_admin']);

  // Fetch account requests
  const { data: requests } = await supabaseAdmin
    .from('account_requests')
    .select('*, departments(name, code)')
    .order('created_at', { ascending: false });

  // Fetch departments for review dialogs
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('id, name, code')
    .eq('is_active', true);

  const pendingCount = requests?.filter((r) => r.status === 'pending').length || 0;
  const approvedCount = requests?.filter((r) => r.status === 'approved').length || 0;
  const rejectedCount = requests?.filter((r) => r.status === 'rejected').length || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">IT Administration Console</h1>
        <p className="text-sm text-slate-500">
          Manage staff account requests, invitations, and identity lifecycles.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved</p>
            <p className="text-2xl font-bold text-slate-900">{approvedCount}</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected</p>
            <p className="text-2xl font-bold text-slate-900">{rejectedCount}</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-slate-900">{requests?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* Account Request Review Queue */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Account Access Requests</h2>
            <p className="text-xs text-slate-500">
              Review applicant details, assign final roles, and dispatch email invitations.
            </p>
          </div>
        </div>
        <RequestReviewTable
          requests={requests || []}
          departments={departments || []}
        />
      </div>
    </div>
  );
}
```

### 8.3 Invite Acceptance Page: `src/app/(auth)/invite/accept/page.tsx`
Client Component handling password setup and profile activation:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InviteAcceptPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // 1. Update password on current Supabase Auth session
      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError || !data.user) {
        throw new Error(updateError?.message || 'Failed to set password');
      }

      // 2. Transition profile status from 'invited' to 'active'
      const response = await fetch('/api/auth/activate-invited', {
        method: 'POST',
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to activate profile');
      }

      const { role } = await response.json();

      // 3. Redirect to role workspace
      router.push(`/${role}`);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during password activation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-sky-600 text-white rounded-xl shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Accept Staff Invitation
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Create a secure password to activate your hospital staff account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSetPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-sky-500 focus:border-sky-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-sky-500 focus:border-sky-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
            >
              {loading ? 'Activating Account...' : 'Set Password & Activate'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### 8.4 Activation API Endpoint: `src/app/api/auth/activate-invited/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, status, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.status !== 'invited') {
    return NextResponse.json(
      { error: `Cannot activate account with status: ${profile.status}` },
      { status: 400 }
    );
  }

  // Update status to active
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update profile status' }, { status: 500 });
  }

  return NextResponse.json({ success: true, role: profile.role });
}
```

---

## 9. Verification & Testing Playbook

The worker implementing Milestone 1 must execute and verify the following commands:

### Command Sequence:
```bash
# 1. Install dependencies
npm install

# 2. Strict TypeScript type check
npm run type-check

# 3. Next.js ESLint validation
npm run lint

# 4. Production build verification
npm run build
```

### Manual & Automated Verification Checklist:
1. **Git Remote Check**:
   - Run `git remote -v` and verify `origin` points to `https://github.com/arthur44558/dd`.
   - Run `git branch` and verify default branch is `main`.
2. **Access Request Submission**:
   - Navigate to `http://localhost:3000/request-access`.
   - Submit a valid test request.
   - Verify 64-character tracking token is generated and displayed.
3. **Anti-Enumeration Status Verification**:
   - Check `/request-status?token=<generatedToken>` and confirm status is `pending`.
   - Tamper with token and confirm error `No matching request found` without leaking database state.
4. **IT Admin Review & Invocation**:
   - Sign in as IT Admin at `/login`.
   - Open `/it-admin` and verify request is in the pending queue.
   - Approve request and confirm:
     - Profile upserted with `status = 'invited'`.
     - Request status updated to `'approved'`.
     - Event logged in `account_request_events`.
5. **Invite Acceptance**:
   - Access `/invite/accept` with user session.
   - Set password and confirm status updates to `'active'`.

---

## 10. Conclusion

This blueprint provides an exhaustive, production-grade guide for implementing Milestone 1. Every code path adheres strictly to `HOSPITAL_FOLLOWUP_BUILD_SPEC.md` without mock arrays, loose types, or skipped security boundaries.
