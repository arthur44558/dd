-- =============================================================================
-- Migration: 20261030000003_m3_m4_approvals_reminders.sql
-- Description: M3 & M4 Approvals Governance, Reminder Schedules & Jobs,
--              Coordinator Pool, Simulated Communications, Outcomes, and 100% RLS.
-- Milestone: M3 & M4
-- =============================================================================

-- 1. SECURITY & ROLE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION is_department_head(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'department_head' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_coordinator(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'coordinator' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_follow_up_head(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'follow_up_head' AND status = 'active'
  );
$$;

-- 2. AUDIT EVENTS TABLE (Pre-requisite / Fallback if M5 has not created it yet)
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  outcome TEXT NOT NULL DEFAULT 'success',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_target ON audit_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- 3. CORRECTION REQUESTS TABLE
CREATE TABLE correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  base_version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  supporting_evidence TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'stale', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correction_requests_follow_up_id ON correction_requests(follow_up_id);
CREATE INDEX idx_correction_requests_requester_id ON correction_requests(requester_id);
CREATE INDEX idx_correction_requests_status ON correction_requests(status);

CREATE TRIGGER trigger_correction_requests_updated_at
  BEFORE UPDATE ON correction_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 4. CORRECTION REQUEST ITEMS TABLE (Field-by-field proposed changes)
CREATE TABLE correction_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES correction_requests(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  original_value TEXT,
  proposed_value TEXT NOT NULL,
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correction_request_items_request_id ON correction_request_items(request_id);

-- 5. APPROVAL DECISIONS TABLE
CREATE TABLE approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES correction_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decision_reason TEXT NOT NULL,
  target_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_decisions_request_id ON approval_decisions(request_id);
CREATE INDEX idx_approval_decisions_approver_id ON approval_decisions(approver_id);

-- 6. SCHEDULE CONFIGS TABLE (Defensive Open Decisions OQ-04..06)
CREATE TABLE schedule_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_configuration' CHECK (status IN ('needs_configuration', 'active', 'archived', 'disabled')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  daytime_start_hour INTEGER NOT NULL DEFAULT 9 CHECK (daytime_start_hour >= 0 AND daytime_start_hour <= 23),
  daytime_end_hour INTEGER NOT NULL DEFAULT 18 CHECK (daytime_end_hour >= 0 AND daytime_end_hour <= 23),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_schedule_configs_updated_at
  BEFORE UPDATE ON schedule_configs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Insert initial default config in needs_configuration state
INSERT INTO schedule_configs (version, name, status, timezone, daytime_start_hour, daytime_end_hour, parameters)
VALUES (1, 'Default Hospital Schedule Config', 'needs_configuration', 'Asia/Kolkata', 9, 18, '{"model": "unapproved", "ratio": "unspecified"}'::jsonb)
ON CONFLICT (version) DO NOTHING;

-- 7. REMINDER SCHEDULES TABLE
CREATE TABLE reminder_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  schedule_version INTEGER NOT NULL DEFAULT 1,
  anchor_date DATE NOT NULL,
  config_version INTEGER REFERENCES schedule_configs(version) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_configuration' CHECK (status IN ('pending_configuration', 'active', 'superseded', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_follow_up_schedule_version UNIQUE (follow_up_id, schedule_version)
);

CREATE INDEX idx_reminder_schedules_follow_up_id ON reminder_schedules(follow_up_id);
CREATE INDEX idx_reminder_schedules_status ON reminder_schedules(status);

CREATE TRIGGER trigger_reminder_schedules_updated_at
  BEFORE UPDATE ON reminder_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 8. REMINDER JOBS TABLE (Durable Queue for FOR UPDATE SKIP LOCKED worker)
CREATE TABLE reminder_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES reminder_schedules(id) ON DELETE SET NULL,
  schedule_version INTEGER NOT NULL DEFAULT 1,
  task_type TEXT NOT NULL CHECK (task_type IN ('pre_appointment_text', 'pre_appointment_call', 'overdue_text_day_2', 'overdue_text_day_4', 'correction_notice', 'custom')),
  channel TEXT NOT NULL DEFAULT 'text' CHECK (channel IN ('text', 'call')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone_context TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 3),
  max_retries INTEGER NOT NULL DEFAULT 3,
  idempotency_key TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  execution_started_at TIMESTAMPTZ,
  terminal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminder_jobs_status_scheduled ON reminder_jobs(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_reminder_jobs_follow_up_id ON reminder_jobs(follow_up_id);
CREATE INDEX idx_reminder_jobs_idempotency_key ON reminder_jobs(idempotency_key);

CREATE TRIGGER trigger_reminder_jobs_updated_at
  BEFORE UPDATE ON reminder_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 9. COMMUNICATION TASKS TABLE (Coordinator Queue)
CREATE TABLE communication_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  reminder_job_id UUID REFERENCES reminder_jobs(id) ON DELETE SET NULL,
  coordinator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('pre_appointment_text', 'pre_appointment_call', 'overdue_text_day_2', 'overdue_text_day_4', 'correction_notice', 'manual_follow_up')),
  channel TEXT NOT NULL CHECK (channel IN ('text', 'call')),
  priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'moderate', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communication_tasks_coordinator_status ON communication_tasks(coordinator_id, status);
CREATE INDEX idx_communication_tasks_follow_up_id ON communication_tasks(follow_up_id);
CREATE INDEX idx_communication_tasks_due_at ON communication_tasks(due_at);
CREATE INDEX idx_communication_tasks_priority ON communication_tasks(priority);

CREATE TRIGGER trigger_communication_tasks_updated_at
  BEFORE UPDATE ON communication_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 10. COMMUNICATION ATTEMPTS TABLE (Simulated Sends & Calls with Mandatory Disclaimer)
CREATE TABLE communication_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES communication_tasks(id) ON DELETE SET NULL,
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  attempt_type TEXT NOT NULL DEFAULT 'manual_simulated_send' CHECK (attempt_type IN ('manual_simulated_send', 'phone_call', 'in_person', 'other')),
  channel TEXT NOT NULL CHECK (channel IN ('text', 'call')),
  call_outcome TEXT CHECK (call_outcome IN ('answered', 'no_answer', 'unreachable', 'callback_requested', 'other')),
  patient_response TEXT CHECK (patient_response IN ('appointment_confirmed', 'rescheduling_requested', 'follow_up_declined', 'clinical_guidance_needed', 'other')),
  is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
  disclaimer TEXT NOT NULL DEFAULT 'Manually confirmed / simulated — not provider verified',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communication_attempts_follow_up_id ON communication_attempts(follow_up_id);
CREATE INDEX idx_communication_attempts_task_id ON communication_attempts(task_id);
CREATE INDEX idx_communication_attempts_actor_id ON communication_attempts(actor_id);

-- 11. COORDINATOR ASSIGNMENTS TABLE
CREATE TABLE coordinator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  coordinator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assignment_strategy TEXT NOT NULL DEFAULT 'manual' CHECK (assignment_strategy IN ('manual', 'round_robin', 'workload_balanced', 'priority_override', 'needs_configuration')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  unassign_reason TEXT,
  is_priority_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT
);

CREATE INDEX idx_coordinator_assignments_coord_active ON coordinator_assignments(coordinator_id, is_active);
CREATE INDEX idx_coordinator_assignments_follow_up ON coordinator_assignments(follow_up_id);

-- 12. COORDINATOR WORKLOAD EVENTS TABLE
CREATE TABLE coordinator_workload_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('task_assigned', 'task_completed', 'task_reassigned', 'priority_override_assigned', 'priority_completed', 'status_changed')),
  task_id UUID REFERENCES communication_tasks(id) ON DELETE SET NULL,
  follow_up_id UUID REFERENCES follow_ups(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coordinator_workload_events_coord ON coordinator_workload_events(coordinator_id);

-- 13. FOLLOW-UP OUTCOMES TABLE
CREATE TABLE follow_up_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'patient_rescheduled', 'patient_refused', 'lost_to_follow_up')),
  attended_appointment BOOLEAN,
  requires_further_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_up_outcomes_follow_up_id ON follow_up_outcomes(follow_up_id);
CREATE INDEX idx_follow_up_outcomes_actor_id ON follow_up_outcomes(actor_id);

-- =============================================================================
-- ATOMIC DOMAIN TRANSACTIONS (ACID RPCs)
-- =============================================================================

-- RPC 1: APPROVE CORRECTION REQUEST (Dept Head approval transaction with FOR UPDATE lock)
CREATE OR REPLACE FUNCTION approve_correction_request(
  p_request_id UUID,
  p_approver_id UUID,
  p_decision_reason TEXT DEFAULT 'Approved by Department Head'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_follow_up RECORD;
  v_item RECORD;
  v_new_version INTEGER;
  v_new_appointment_date DATE;
  v_new_severity TEXT;
  v_new_notes TEXT;
  v_new_follow_up_required BOOLEAN;
  v_approver_role user_role;
  v_approver_dept UUID;
BEGIN
  -- 1. Validate approver
  SELECT role, department_id INTO v_approver_role, v_approver_dept
  FROM profiles
  WHERE id = p_approver_id AND status = 'active';

  IF v_approver_role IS NULL OR (v_approver_role != 'department_head' AND v_approver_role != 'it_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only Department Heads can approve correction requests';
  END IF;

  -- 2. Lock correction_request row
  SELECT * INTO v_request
  FROM correction_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Correction request % not found', p_request_id;
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Correction request is not in pending status (current status: %)', v_request.status;
  END IF;

  -- 3. Lock follow_up row
  SELECT * INTO v_follow_up
  FROM follow_ups
  WHERE id = v_request.follow_up_id
  FOR UPDATE;

  IF v_follow_up.id IS NULL THEN
    RAISE EXCEPTION 'Linked follow-up % not found', v_request.follow_up_id;
  END IF;

  -- Verify department scope (if not IT admin)
  IF v_approver_role = 'department_head' AND v_approver_dept != v_follow_up.department_id THEN
    RAISE EXCEPTION 'Unauthorized: Department Head can only approve requests in their own department';
  END IF;

  -- 4. Optimistic Version Lock Check
  IF v_request.base_version != v_follow_up.current_version THEN
    -- Mark this proposal as stale
    UPDATE correction_requests SET status = 'stale', updated_at = NOW() WHERE id = p_request_id;
    UPDATE correction_request_items SET is_stale = TRUE WHERE request_id = p_request_id;
    RAISE EXCEPTION 'Optimistic concurrency error: base_version % does not match current follow_up version %',
      v_request.base_version, v_follow_up.current_version;
  END IF;

  -- 5. Prepare new values based on existing follow-up
  v_new_appointment_date := v_follow_up.appointment_date;
  v_new_severity := v_follow_up.severity;
  v_new_notes := v_follow_up.notes;
  v_new_follow_up_required := v_follow_up.follow_up_required;
  v_new_version := v_follow_up.current_version + 1;

  -- 6. Apply proposed changes from correction_request_items
  FOR v_item IN
    SELECT field_name, proposed_value
    FROM correction_request_items
    WHERE request_id = p_request_id
  LOOP
    IF v_item.field_name = 'appointment_date' THEN
      v_new_appointment_date := v_item.proposed_value::DATE;
    ELSIF v_item.field_name = 'severity' THEN
      v_new_severity := v_item.proposed_value;
    ELSIF v_item.field_name = 'notes' THEN
      v_new_notes := v_item.proposed_value;
    ELSIF v_item.field_name = 'follow_up_required' THEN
      v_new_follow_up_required := (LOWER(v_item.proposed_value) = 'true' OR v_item.proposed_value = '1');
    END IF;
  END LOOP;

  -- 7. Update follow_up with new values and incremented version
  UPDATE follow_ups
  SET appointment_date = v_new_appointment_date,
      severity = v_new_severity,
      notes = v_new_notes,
      follow_up_required = v_new_follow_up_required,
      current_version = v_new_version,
      updated_at = NOW()
  WHERE id = v_follow_up.id;

  -- 8. Create immutable version snapshot in follow_up_versions
  INSERT INTO follow_up_versions (
    follow_up_id,
    version_number,
    snapshot,
    source_document_id,
    created_by,
    created_at
  ) VALUES (
    v_follow_up.id,
    v_new_version,
    jsonb_build_object(
      'appointment_date', v_new_appointment_date,
      'severity', v_new_severity,
      'notes', v_new_notes,
      'follow_up_required', v_new_follow_up_required,
      'approved_by', p_approver_id,
      'reason', v_request.reason,
      'base_version', v_request.base_version
    ),
    NULL,
    p_approver_id,
    NOW()
  );

  -- 9. Mark correction_request as approved
  UPDATE correction_requests
  SET status = 'approved',
      updated_at = NOW()
  WHERE id = p_request_id;

  -- 10. Record approval decision
  INSERT INTO approval_decisions (
    request_id,
    approver_id,
    decision,
    decision_reason,
    target_version,
    created_at
  ) VALUES (
    p_request_id,
    p_approver_id,
    'approved',
    COALESCE(p_decision_reason, 'Approved by Department Head'),
    v_new_version,
    NOW()
  );

  -- 11. Stale handling: Flag competing pending proposals for this follow-up as stale
  UPDATE correction_requests
  SET status = 'stale',
      updated_at = NOW()
  WHERE follow_up_id = v_follow_up.id
    AND id != p_request_id
    AND status = 'pending';

  UPDATE correction_request_items
  SET is_stale = TRUE
  WHERE request_id IN (
    SELECT id FROM correction_requests
    WHERE follow_up_id = v_follow_up.id
      AND id != p_request_id
      AND status = 'stale'
  );

  -- 12. Cancel unsent jobs from superseded schedule
  UPDATE reminder_jobs
  SET status = 'cancelled',
      terminal_at = NOW(),
      updated_at = NOW()
  WHERE follow_up_id = v_follow_up.id
    AND status = 'pending';

  -- Supersede current reminder_schedules
  UPDATE reminder_schedules
  SET status = 'superseded',
      updated_at = NOW()
  WHERE follow_up_id = v_follow_up.id
    AND status = 'active';

  -- 13. Write immutable audit log
  INSERT INTO audit_events (
    actor_id,
    role,
    action,
    target_type,
    target_id,
    outcome,
    details
  ) VALUES (
    p_approver_id,
    v_approver_role::text,
    'correction_request_approved',
    'follow_up',
    v_follow_up.id,
    'success',
    jsonb_build_object(
      'request_id', p_request_id,
      'base_version', v_request.base_version,
      'new_version', v_new_version,
      'reason', v_request.reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'follow_up_id', v_follow_up.id,
    'new_version', v_new_version
  );
END;
$$;

-- RPC 2: REJECT CORRECTION REQUEST (With mandatory reason)
CREATE OR REPLACE FUNCTION reject_correction_request(
  p_request_id UUID,
  p_approver_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_follow_up RECORD;
  v_approver_role user_role;
  v_approver_dept UUID;
BEGIN
  -- Rejection reason is strictly mandatory
  IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'A non-empty rejection reason is mandatory';
  END IF;

  -- Validate approver
  SELECT role, department_id INTO v_approver_role, v_approver_dept
  FROM profiles
  WHERE id = p_approver_id AND status = 'active';

  IF v_approver_role IS NULL OR (v_approver_role != 'department_head' AND v_approver_role != 'it_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only Department Heads can reject correction requests';
  END IF;

  -- Lock request
  SELECT * INTO v_request
  FROM correction_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Correction request % not found', p_request_id;
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Correction request is not in pending status (current status: %)', v_request.status;
  END IF;

  -- Verify department
  SELECT * INTO v_follow_up FROM follow_ups WHERE id = v_request.follow_up_id;
  IF v_approver_role = 'department_head' AND v_approver_dept != v_follow_up.department_id THEN
    RAISE EXCEPTION 'Unauthorized: Department Head can only reject requests in their own department';
  END IF;

  -- Update request to rejected
  UPDATE correction_requests
  SET status = 'rejected',
      updated_at = NOW()
  WHERE id = p_request_id;

  -- Insert decision
  INSERT INTO approval_decisions (
    request_id,
    approver_id,
    decision,
    decision_reason,
    target_version,
    created_at
  ) VALUES (
    p_request_id,
    p_approver_id,
    'rejected',
    TRIM(p_rejection_reason),
    NULL,
    NOW()
  );

  -- Log audit
  INSERT INTO audit_events (
    actor_id,
    role,
    action,
    target_type,
    target_id,
    outcome,
    details
  ) VALUES (
    p_approver_id,
    v_approver_role::text,
    'correction_request_rejected',
    'follow_up',
    v_request.follow_up_id,
    'success',
    jsonb_build_object(
      'request_id', p_request_id,
      'rejection_reason', TRIM(p_rejection_reason)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected'
  );
END;
$$;

-- RPC 3: EVALUATE OVERDUE FOLLOW-UPS (+2 and +4 calendar days in Asia/Kolkata)
CREATE OR REPLACE FUNCTION evaluate_overdue_follow_ups(
  p_hospital_timezone TEXT DEFAULT 'Asia/Kolkata'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_hospital DATE;
  v_rec RECORD;
  v_overdue_count INTEGER := 0;
  v_d2_scheduled TIMESTAMPTZ;
  v_d4_scheduled TIMESTAMPTZ;
  v_key_d2 TEXT;
  v_key_d4 TEXT;
BEGIN
  -- Compute current date in hospital timezone
  v_today_hospital := (CURRENT_TIMESTAMP AT TIME ZONE p_hospital_timezone)::DATE;

  FOR v_rec IN
    SELECT id, appointment_date, severity
    FROM follow_ups
    WHERE follow_up_required = TRUE
      AND status IN ('submitted', 'active')
      AND appointment_date < v_today_hospital
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 1. Transition follow-up state to OVERDUE
    UPDATE follow_ups
    SET status = 'overdue',
        updated_at = NOW()
    WHERE id = v_rec.id;

    -- 2. Calculate +2 and +4 calendar days at 10:00 AM hospital timezone
    v_d2_scheduled := ((v_rec.appointment_date + INTERVAL '2 days')::date::text || ' 10:00:00')::timestamp AT TIME ZONE p_hospital_timezone;
    v_d4_scheduled := ((v_rec.appointment_date + INTERVAL '4 days')::date::text || ' 10:00:00')::timestamp AT TIME ZONE p_hospital_timezone;

    v_key_d2 := 'overdue-d2-' || v_rec.id::text || '-' || v_rec.appointment_date::text;
    v_key_d4 := 'overdue-d4-' || v_rec.id::text || '-' || v_rec.appointment_date::text;

    -- 3. Insert overdue text job for Day +2 (idempotent)
    INSERT INTO reminder_jobs (
      follow_up_id,
      schedule_version,
      task_type,
      channel,
      scheduled_at,
      timezone_context,
      status,
      idempotency_key
    ) VALUES (
      v_rec.id,
      1,
      'overdue_text_day_2',
      'text',
      v_d2_scheduled,
      p_hospital_timezone,
      'pending',
      v_key_d2
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    -- 4. Insert overdue text job for Day +4 (idempotent)
    INSERT INTO reminder_jobs (
      follow_up_id,
      schedule_version,
      task_type,
      channel,
      scheduled_at,
      timezone_context,
      status,
      idempotency_key
    ) VALUES (
      v_rec.id,
      1,
      'overdue_text_day_4',
      'text',
      v_d4_scheduled,
      p_hospital_timezone,
      'pending',
      v_key_d4
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    v_overdue_count := v_overdue_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'hospital_date', v_today_hospital,
    'transitioned_overdue_count', v_overdue_count
  );
END;
$$;

-- RPC 4: PROCESS DUE REMINDER JOBS (SKIP LOCKED worker)
CREATE OR REPLACE FUNCTION process_due_reminder_jobs(
  p_batch_size INTEGER DEFAULT 50,
  p_worker_id TEXT DEFAULT 'cron-worker'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_processed_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_follow_up RECORD;
  v_task_priority TEXT;
BEGIN
  FOR v_job IN
    SELECT *
    FROM reminder_jobs
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
      AND retry_count < max_retries
    ORDER BY scheduled_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Lock job for processing
    UPDATE reminder_jobs
    SET status = 'processing',
        locked_at = NOW(),
        locked_by = p_worker_id,
        execution_started_at = NOW(),
        updated_at = NOW()
    WHERE id = v_job.id;

    -- Verify parent follow-up status
    SELECT * INTO v_follow_up FROM follow_ups WHERE id = v_job.follow_up_id;

    IF v_follow_up.id IS NULL OR v_follow_up.status IN ('completed', 'cancelled') THEN
      -- Cancel job since follow-up is already resolved or absent
      UPDATE reminder_jobs
      SET status = 'cancelled',
          terminal_at = NOW(),
          last_error = 'Follow-up is completed or cancelled',
          updated_at = NOW()
      WHERE id = v_job.id;
      CONTINUE;
    END IF;

    -- Determine task priority from follow_up severity
    v_task_priority := COALESCE(v_follow_up.severity, 'routine');

    -- Materialize coordinator communication task
    INSERT INTO communication_tasks (
      follow_up_id,
      reminder_job_id,
      coordinator_id,
      task_type,
      channel,
      priority,
      status,
      due_at,
      notes
    ) VALUES (
      v_job.follow_up_id,
      v_job.id,
      (SELECT coordinator_id FROM coordinator_assignments WHERE follow_up_id = v_job.follow_up_id AND is_active = TRUE LIMIT 1),
      v_job.task_type,
      v_job.channel,
      v_task_priority,
      'pending',
      v_job.scheduled_at,
      'Scheduled via ' || v_job.task_type
    );

    -- Mark job completed
    UPDATE reminder_jobs
    SET status = 'completed',
        terminal_at = NOW(),
        updated_at = NOW()
    WHERE id = v_job.id;

    v_processed_count := v_processed_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'worker_id', p_worker_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (100% DEFAULT-DENY ON ALL TABLES)
-- =============================================================================

ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_workload_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_outcomes ENABLE ROW LEVEL SECURITY;

-- 1. CORRECTION REQUESTS POLICIES
CREATE POLICY "Correction requests viewable by clinical staff in dept, requester or admin"
  ON correction_requests FOR SELECT
  TO authenticated
  USING (
    is_it_admin(auth.uid()) OR
    requester_id = auth.uid() OR
    user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = correction_requests.follow_up_id))
  );

CREATE POLICY "Clinical staff can insert correction requests"
  ON correction_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    requester_id = auth.uid() AND
    get_user_role(auth.uid()) IN ('doctor', 'assistant', 'department_head')
  );

CREATE POLICY "Department Heads can update correction requests in their dept"
  ON correction_requests FOR UPDATE
  TO authenticated
  USING (
    is_it_admin(auth.uid()) OR
    (is_department_head(auth.uid()) AND user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = correction_requests.follow_up_id)))
  )
  WITH CHECK (
    is_it_admin(auth.uid()) OR
    (is_department_head(auth.uid()) AND user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = correction_requests.follow_up_id)))
  );

-- 2. CORRECTION REQUEST ITEMS POLICIES
CREATE POLICY "Items viewable according to request visibility"
  ON correction_request_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM correction_requests cr
      WHERE cr.id = correction_request_items.request_id
        AND (
          is_it_admin(auth.uid()) OR
          cr.requester_id = auth.uid() OR
          user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = cr.follow_up_id))
        )
    )
  );

CREATE POLICY "Requester can insert request items"
  ON correction_request_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM correction_requests cr
      WHERE cr.id = correction_request_items.request_id AND cr.requester_id = auth.uid()
    )
  );

-- 3. APPROVAL DECISIONS POLICIES
CREATE POLICY "Approval decisions viewable by dept staff, requester or admin"
  ON approval_decisions FOR SELECT
  TO authenticated
  USING (
    is_it_admin(auth.uid()) OR
    approver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM correction_requests cr
      WHERE cr.id = approval_decisions.request_id
        AND (
          cr.requester_id = auth.uid() OR
          user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = cr.follow_up_id))
        )
    )
  );

-- 4. SCHEDULE CONFIGS POLICIES
CREATE POLICY "Schedule configs viewable by active staff"
  ON schedule_configs FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

CREATE POLICY "Schedule configs manageable by IT Admin and Follow-up Head"
  ON schedule_configs FOR ALL
  TO authenticated
  USING (is_it_admin(auth.uid()) OR is_follow_up_head(auth.uid()))
  WITH CHECK (is_it_admin(auth.uid()) OR is_follow_up_head(auth.uid()));

-- 5. REMINDER SCHEDULES POLICIES
CREATE POLICY "Reminder schedules viewable by authorized staff"
  ON reminder_schedules FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    (
      is_it_admin(auth.uid()) OR
      is_follow_up_head(auth.uid()) OR
      is_coordinator(auth.uid()) OR
      user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = reminder_schedules.follow_up_id))
    )
  );

-- 6. REMINDER JOBS POLICIES
CREATE POLICY "Reminder jobs viewable by authorized staff"
  ON reminder_jobs FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    (
      is_it_admin(auth.uid()) OR
      is_follow_up_head(auth.uid()) OR
      user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = reminder_jobs.follow_up_id))
    )
  );

-- 7. COMMUNICATION TASKS POLICIES
CREATE POLICY "Coordinators view assigned tasks, Head views all"
  ON communication_tasks FOR SELECT
  TO authenticated
  USING (
    is_it_admin(auth.uid()) OR
    is_follow_up_head(auth.uid()) OR
    coordinator_id = auth.uid() OR
    (coordinator_id IS NULL AND is_coordinator(auth.uid()))
  );

CREATE POLICY "Coordinators can update their own tasks"
  ON communication_tasks FOR UPDATE
  TO authenticated
  USING (coordinator_id = auth.uid() OR is_follow_up_head(auth.uid()) OR is_it_admin(auth.uid()))
  WITH CHECK (coordinator_id = auth.uid() OR is_follow_up_head(auth.uid()) OR is_it_admin(auth.uid()));

-- 8. COMMUNICATION ATTEMPTS POLICIES (Append-only: No UPDATE / DELETE)
CREATE POLICY "Communication attempts viewable by staff"
  ON communication_attempts FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    (
      actor_id = auth.uid() OR
      is_it_admin(auth.uid()) OR
      is_follow_up_head(auth.uid()) OR
      user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = communication_attempts.follow_up_id))
    )
  );

CREATE POLICY "Active staff can insert communication attempts"
  ON communication_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    actor_id = auth.uid()
  );

-- 9. COORDINATOR ASSIGNMENTS POLICIES
CREATE POLICY "Assignments viewable by coordinators and management"
  ON coordinator_assignments FOR SELECT
  TO authenticated
  USING (
    is_it_admin(auth.uid()) OR
    is_follow_up_head(auth.uid()) OR
    coordinator_id = auth.uid()
  );

CREATE POLICY "Follow-up Head and Admin can manage assignments"
  ON coordinator_assignments FOR ALL
  TO authenticated
  USING (is_follow_up_head(auth.uid()) OR is_it_admin(auth.uid()))
  WITH CHECK (is_follow_up_head(auth.uid()) OR is_it_admin(auth.uid()));

-- 10. COORDINATOR WORKLOAD EVENTS POLICIES (Append-only)
CREATE POLICY "Workload events viewable by coordinator and management"
  ON coordinator_workload_events FOR SELECT
  TO authenticated
  USING (
    is_it_admin(auth.uid()) OR
    is_follow_up_head(auth.uid()) OR
    coordinator_id = auth.uid()
  );

CREATE POLICY "Active staff can record workload events"
  ON coordinator_workload_events FOR INSERT
  TO authenticated
  WITH CHECK (is_active_user(auth.uid()));

-- 11. FOLLOW-UP OUTCOMES POLICIES (Append-only: No UPDATE / DELETE)
CREATE POLICY "Outcomes viewable by authorized staff"
  ON follow_up_outcomes FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    (
      actor_id = auth.uid() OR
      is_it_admin(auth.uid()) OR
      is_follow_up_head(auth.uid()) OR
      user_in_department(auth.uid(), (SELECT department_id FROM follow_ups WHERE id = follow_up_outcomes.follow_up_id))
    )
  );

CREATE POLICY "Active clinical staff and coordinators can record outcomes"
  ON follow_up_outcomes FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    actor_id = auth.uid() AND
    get_user_role(auth.uid()) IN ('coordinator', 'assistant', 'doctor', 'department_head', 'follow_up_head')
  );
