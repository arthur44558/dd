-- =============================================================================
-- Migration: 20261030000001_m1_foundation_and_access_requests.sql
-- Description: Core Enums, Organization, Profiles, Access Requests, and 100% RLS
-- Milestone: M1 (Foundation, Git Setup & Access Request Workflow)
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

-- Secure public token lookup RPC (Anti-enumeration: does not leak email, employee_id, or internal notes)
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
