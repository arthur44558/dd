-- =============================================================================
-- Migration: 20261030000002_m2_patients_and_intake.sql
-- Description: Patient Registry, Deduplication RPC, Contacts, Consultations,
--              Follow-ups, Follow-up Versions, Source Documents, and 100% RLS.
-- Milestone: M2/M3 (Patients, Deduplication, Clinical Intake & Scans)
-- =============================================================================

-- 1. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS patient_mrn_seq START WITH 100001;

-- 2. PATIENTS TABLE
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn TEXT NOT NULL UNIQUE DEFAULT ('MRN-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('patient_mrn_seq')::text, 6, '0')),
  full_name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  primary_phone TEXT NOT NULL,
  address TEXT,
  registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_full_name ON patients(LOWER(full_name));
CREATE INDEX idx_patients_primary_phone ON patients(primary_phone);
CREATE INDEX idx_patients_dob ON patients(dob);

CREATE TRIGGER trigger_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 3. PATIENT CONTACTS TABLE
CREATE TABLE patient_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('primary_phone', 'secondary_phone', 'emergency_contact', 'relative', 'email')),
  contact_value TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_shared_contact BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_contacts_patient_id ON patient_contacts(patient_id);
CREATE INDEX idx_patient_contacts_value ON patient_contacts(contact_value);

CREATE TRIGGER trigger_patient_contacts_updated_at
  BEFORE UPDATE ON patient_contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 4. PATIENT PROFILE VERSIONS (Demographic Snapshot & Governance)
CREATE TABLE patient_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_reason TEXT NOT NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_patient_version UNIQUE (patient_id, version_number)
);

CREATE INDEX idx_patient_profile_versions_patient_id ON patient_profile_versions(patient_id);

-- 5. CONSULTATIONS TABLE
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  consultation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX idx_consultations_department_id ON consultations(department_id);

CREATE TRIGGER trigger_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 6. FOLLOW-UPS TABLE
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  responsible_assistant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  follow_up_required BOOLEAN NOT NULL DEFAULT TRUE,
  severity TEXT NOT NULL CHECK (severity IN ('routine', 'moderate', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'active', 'overdue', 'completed', 'cancelled')),
  current_version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_patient_id ON follow_ups(patient_id);
CREATE INDEX idx_follow_ups_doctor_id ON follow_ups(doctor_id);
CREATE INDEX idx_follow_ups_department_id ON follow_ups(department_id);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_follow_ups_appointment_date ON follow_ups(appointment_date);

CREATE TRIGGER trigger_follow_ups_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 7. SOURCE DOCUMENTS TABLE (Private scanned forms and evidence)
CREATE TABLE source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID REFERENCES follow_ups(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  sha256_hash TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_documents_follow_up_id ON source_documents(follow_up_id);
CREATE INDEX idx_source_documents_hash ON source_documents(sha256_hash);

-- 8. FOLLOW-UP VERSIONS (Immutable snapshots)
CREATE TABLE follow_up_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_document_id UUID REFERENCES source_documents(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_follow_up_version UNIQUE (follow_up_id, version_number)
);

CREATE INDEX idx_follow_up_versions_follow_up_id ON follow_up_versions(follow_up_id);

-- 9. HELPER FUNCTIONS FOR ROLE & RELATIONSHIP ACCESS
CREATE OR REPLACE FUNCTION get_user_doctor_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM doctor_profiles
  WHERE profile_id = p_user_id AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION user_in_department(p_user_id UUID, p_dept_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM department_memberships
    WHERE profile_id = p_user_id AND department_id = p_dept_id AND is_active = TRUE
  );
$$;

-- 10. DEDUPLICATION SEARCH RPC
CREATE OR REPLACE FUNCTION search_patients_for_dedup(
  p_query TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  patient_id UUID,
  mrn TEXT,
  full_name TEXT,
  dob DATE,
  gender TEXT,
  primary_phone TEXT,
  match_reasons TEXT[],
  is_shared_contact BOOLEAN,
  shared_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_norm_phone TEXT := NULL;
  v_query TEXT := NULL;
BEGIN
  IF p_phone IS NOT NULL AND TRIM(p_phone) <> '' THEN
    v_norm_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
    IF LENGTH(v_norm_phone) > 10 THEN
      v_norm_phone := SUBSTRING(v_norm_phone FROM LENGTH(v_norm_phone) - 9 FOR 10);
    END IF;
  END IF;

  IF p_query IS NOT NULL AND TRIM(p_query) <> '' THEN
    v_query := TRIM(p_query);
  END IF;

  IF v_query IS NULL AND v_norm_phone IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matched_patients AS (
    SELECT
      p.id,
      p.mrn,
      p.full_name,
      p.dob,
      p.gender,
      p.primary_phone,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN v_query IS NOT NULL AND p.mrn ILIKE '%' || v_query || '%' THEN 'MRN match' END,
        CASE WHEN v_query IS NOT NULL AND p.full_name ILIKE '%' || v_query || '%' THEN 'Name match' END,
        CASE WHEN v_norm_phone IS NOT NULL AND (
          regexp_replace(p.primary_phone, '[^0-9]', '', 'g') LIKE '%' || v_norm_phone
          OR EXISTS (
            SELECT 1 FROM patient_contacts pc
            WHERE pc.patient_id = p.id
              AND regexp_replace(pc.contact_value, '[^0-9]', '', 'g') LIKE '%' || v_norm_phone
          )
        ) THEN 'Phone match' END
      ], NULL) AS reasons
    FROM patients p
  ),
  filtered AS (
    SELECT * FROM matched_patients
    WHERE ARRAY_LENGTH(reasons, 1) > 0
  ),
  phone_sharing AS (
    SELECT
      p.id AS patient_id_chk,
      COUNT(DISTINCT other.id) AS share_cnt
    FROM patients p
    JOIN patients other ON (
      regexp_replace(p.primary_phone, '[^0-9]', '', 'g') = regexp_replace(other.primary_phone, '[^0-9]', '', 'g')
      OR EXISTS (
        SELECT 1 FROM patient_contacts pc
        WHERE pc.patient_id = other.id
          AND regexp_replace(pc.contact_value, '[^0-9]', '', 'g') = regexp_replace(p.primary_phone, '[^0-9]', '', 'g')
      )
    )
    GROUP BY p.id
  )
  SELECT
    f.id AS patient_id,
    f.mrn,
    f.full_name,
    f.dob,
    f.gender,
    f.primary_phone,
    f.reasons AS match_reasons,
    COALESCE(ps.share_cnt > 1, FALSE) AS is_shared_contact,
    COALESCE(ps.share_cnt, 1) AS shared_count
  FROM filtered f
  LEFT JOIN phone_sharing ps ON ps.patient_id_chk = f.id
  ORDER BY ARRAY_LENGTH(f.reasons, 1) DESC, f.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION search_patients_for_dedup(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY (100% DEFAULT-DENY)
-- =============================================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_versions ENABLE ROW LEVEL SECURITY;

-- 1. PATIENTS POLICIES
CREATE POLICY "Active staff can view patients"
  ON patients FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

CREATE POLICY "Reception and Assistant can register patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('reception', 'assistant')
  );

CREATE POLICY "Department Head and IT Admin can update patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('department_head', 'it_admin')
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('department_head', 'it_admin')
  );

-- 2. PATIENT CONTACTS POLICIES
CREATE POLICY "Active staff can view patient contacts"
  ON patient_contacts FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

CREATE POLICY "Reception and Assistant can insert patient contacts"
  ON patient_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('reception', 'assistant')
  );

CREATE POLICY "Reception, Assistant and Dept Head can update contacts"
  ON patient_contacts FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('reception', 'assistant', 'department_head')
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('reception', 'assistant', 'department_head')
  );

-- 3. PATIENT PROFILE VERSIONS POLICIES
CREATE POLICY "Active staff can view patient profile versions"
  ON patient_profile_versions FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

CREATE POLICY "Dept Head and IT Admin can insert patient profile versions"
  ON patient_profile_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('department_head', 'it_admin')
  );

-- 4. CONSULTATIONS POLICIES
-- Strict Isolation: Reception is prohibited from clinical consultations
CREATE POLICY "Clinical staff can view consultations"
  ON consultations FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) != 'reception'
  );

CREATE POLICY "Assistant and Doctor can insert consultations"
  ON consultations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor')
  );

CREATE POLICY "Assistant, Doctor and Dept Head can update consultations"
  ON consultations FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor', 'department_head')
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor', 'department_head')
  );

-- 5. FOLLOW-UPS POLICIES
-- Strict Isolation: Reception has 0% access. Roles have scoped access.
CREATE POLICY "Authorized clinical staff can view follow-ups"
  ON follow_ups FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) != 'reception' AND (
      get_user_role(auth.uid()) IN ('follow_up_head', 'it_admin') OR
      responsible_assistant_id = auth.uid() OR
      doctor_id = get_user_doctor_id(auth.uid()) OR
      user_in_department(auth.uid(), department_id) OR
      get_user_role(auth.uid()) = 'coordinator'
    )
  );

CREATE POLICY "Assistant can create follow-up draft"
  ON follow_ups FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) = 'assistant'
  );

CREATE POLICY "Assistant can update own draft follow-ups"
  ON follow_ups FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) = 'assistant' AND
    status = 'draft' AND
    responsible_assistant_id = auth.uid()
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) = 'assistant' AND
    responsible_assistant_id = auth.uid()
  );

CREATE POLICY "Doctor can review and submit assigned follow-ups"
  ON follow_ups FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) = 'doctor' AND
    doctor_id = get_user_doctor_id(auth.uid())
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) = 'doctor' AND
    doctor_id = get_user_doctor_id(auth.uid())
  );

CREATE POLICY "Department Head can manage department follow-ups"
  ON follow_ups FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) = 'department_head' AND
    user_in_department(auth.uid(), department_id)
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) = 'department_head' AND
    user_in_department(auth.uid(), department_id)
  );

-- 6. SOURCE DOCUMENTS POLICIES
-- Private scans: No public access. Accessible only by non-reception clinical staff.
CREATE POLICY "Clinical staff can view source documents"
  ON source_documents FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) != 'reception'
  );

CREATE POLICY "Assistant and Doctor can upload source documents"
  ON source_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor')
  );

-- 7. FOLLOW-UP VERSIONS POLICIES (Immutable history)
CREATE POLICY "Clinical staff can view follow-up versions"
  ON follow_up_versions FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) != 'reception'
  );

CREATE POLICY "Clinical staff can insert follow-up version snapshots"
  ON follow_up_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor', 'department_head')
  );

-- 8. STORAGE BUCKET CONFIGURATION (Private bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'follow_up_scans',
  'follow_up_scans',
  FALSE,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg'];

CREATE POLICY "Allow clinical staff to view scans"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'follow_up_scans' AND
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) != 'reception'
  );

CREATE POLICY "Allow assistants and doctors to upload scans"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'follow_up_scans' AND
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor')
  );
