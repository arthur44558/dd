-- =============================================================================
-- Migration: 20261030000004_m5_inquiries_notifications_audit.sql
-- Description: Contextual Clinical Inquiries, Notification Center, Immutable Audit Events,
--              and AI Assistance Events with 100% Default-Deny RLS
-- Milestone: M5 (Inquiries, Notifications, Audit & Analytics)
-- =============================================================================

-- 1. INTERNAL CLINICAL INQUIRIES TABLE
-- Anchored to follow-up record, Coordinator -> Assistant -> Doctor chain
CREATE TABLE internal_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'answered', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_internal_queries_follow_up_id ON internal_queries(follow_up_id);
CREATE INDEX idx_internal_queries_created_by ON internal_queries(created_by);
CREATE INDEX idx_internal_queries_assigned_to ON internal_queries(assigned_to);
CREATE INDEX idx_internal_queries_status ON internal_queries(status);
CREATE INDEX idx_internal_queries_created_at ON internal_queries(created_at DESC);

CREATE TRIGGER trigger_internal_queries_updated_at
  BEFORE UPDATE ON internal_queries
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 2. QUERY MESSAGES TABLE
-- Threaded message posts with escalation trail
CREATE TABLE query_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES internal_queries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_escalation BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_query_messages_query_id ON query_messages(query_id);
CREATE INDEX idx_query_messages_sender_id ON query_messages(sender_id);
CREATE INDEX idx_query_messages_recipient_id ON query_messages(recipient_id);
CREATE INDEX idx_query_messages_escalated_to ON query_messages(escalated_to);
CREATE INDEX idx_query_messages_created_at ON query_messages(created_at ASC);

-- 3. NOTIFICATIONS TABLE
-- Staff notifications with unread counts and safe deep links
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'inquiry', 'approval', 'overdue', 'assignment', 'system')),
  target_type TEXT,
  target_id TEXT,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, is_read, created_at DESC);

-- 4. AUDIT EVENTS TABLE (STRICTLY IMMUTABLE)
-- Immutable system-wide audit trail for compliance and forensic verification
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role user_role,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failure', 'denied')),
  reason TEXT,
  correlation_id TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_actor_id ON audit_events(actor_id);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_target ON audit_events(target_type, target_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);

-- IMMUTABILITY ENFORCEMENT TRIGGER ON AUDIT_EVENTS
-- ZERO UPDATE or DELETE operations permitted under ANY condition
CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is strictly immutable: UPDATE and DELETE operations are forbidden by hospital compliance policy';
END;
$$;

CREATE TRIGGER trigger_audit_events_immutability
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_events_mutation();

-- 5. AI ASSISTANCE EVENTS TABLE
-- Human-in-the-loop audit trail for OCR/Form extraction suggestions
CREATE TABLE ai_assistance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock_adaption_labs',
  purpose TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  document_reference TEXT,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings TEXT[] NOT NULL DEFAULT '{}',
  human_reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  accepted_fields JSONB,
  modified_fields JSONB,
  outcome TEXT NOT NULL DEFAULT 'pending_review' CHECK (outcome IN ('pending_review', 'accepted', 'modified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_assistance_events_reviewer ON ai_assistance_events(human_reviewer_id);
CREATE INDEX idx_ai_assistance_events_input_hash ON ai_assistance_events(input_hash);
CREATE INDEX idx_ai_assistance_events_created_at ON ai_assistance_events(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (100% DEFAULT-DENY)
-- =============================================================================

ALTER TABLE internal_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistance_events ENABLE ROW LEVEL SECURITY;

-- 1. INTERNAL QUERIES POLICIES
-- Staff can view queries if:
-- - They created it
-- - They are assigned to it
-- - They are IT Admin
-- - They are Follow-up Head
-- - They are Doctor/Assistant/Dept Head associated with the follow-up
CREATE POLICY "internal_queries_select"
  ON internal_queries FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      is_it_admin(auth.uid()) OR
      get_user_role(auth.uid()) = 'follow_up_head' OR
      EXISTS (
        SELECT 1 FROM follow_ups f
        WHERE f.id = internal_queries.follow_up_id AND (
          f.responsible_assistant_id = auth.uid() OR
          f.doctor_id = get_user_doctor_id(auth.uid()) OR
          user_in_department(auth.uid(), f.department_id)
        )
      )
    )
  );

CREATE POLICY "internal_queries_insert"
  ON internal_queries FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    created_by = auth.uid() AND
    get_user_role(auth.uid()) IN ('coordinator', 'assistant', 'doctor', 'department_head')
  );

CREATE POLICY "internal_queries_update"
  ON internal_queries FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      is_it_admin(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM follow_ups f
        WHERE f.id = internal_queries.follow_up_id AND (
          f.responsible_assistant_id = auth.uid() OR
          f.doctor_id = get_user_doctor_id(auth.uid()) OR
          user_in_department(auth.uid(), f.department_id)
        )
      )
    )
  )
  WITH CHECK (
    is_active_user(auth.uid())
  );

-- No DELETE policy on internal_queries (deletion prohibited)

-- 2. QUERY MESSAGES POLICIES
-- Messages are viewable by anyone who can see the parent query
CREATE POLICY "query_messages_select"
  ON query_messages FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM internal_queries q
      WHERE q.id = query_messages.query_id AND (
        q.created_by = auth.uid() OR
        q.assigned_to = auth.uid() OR
        is_it_admin(auth.uid()) OR
        get_user_role(auth.uid()) = 'follow_up_head' OR
        EXISTS (
          SELECT 1 FROM follow_ups f
          WHERE f.id = q.follow_up_id AND (
            f.responsible_assistant_id = auth.uid() OR
            f.doctor_id = get_user_doctor_id(auth.uid()) OR
            user_in_department(auth.uid(), f.department_id)
          )
        )
      )
    )
  );

CREATE POLICY "query_messages_insert"
  ON query_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM internal_queries q
      WHERE q.id = query_messages.query_id
    )
  );

-- Messages are immutable: No UPDATE and No DELETE policies

-- 3. NOTIFICATIONS POLICIES
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    recipient_id = auth.uid()
  );

CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid())
  );

CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    recipient_id = auth.uid()
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    recipient_id = auth.uid()
  );

-- 4. AUDIT EVENTS POLICIES (IMMUTABLE AUDIT TRAIL)
-- IT Admins and Department Heads can view audit events (Dept heads within dept or general)
CREATE POLICY "audit_events_select"
  ON audit_events FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND (
      is_it_admin(auth.uid()) OR
      get_user_role(auth.uid()) = 'department_head' OR
      get_user_role(auth.uid()) = 'follow_up_head'
    )
  );

-- Authenticated active staff can insert audit events documenting operations
CREATE POLICY "audit_events_insert"
  ON audit_events FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      actor_id = auth.uid() OR actor_id IS NULL
    )
  );

-- ZERO UPDATE POLICY for audit_events (Forbidden)
-- ZERO DELETE POLICY for audit_events (Forbidden)

-- 5. AI ASSISTANCE EVENTS POLICIES
CREATE POLICY "ai_assistance_events_select"
  ON ai_assistance_events FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor', 'department_head', 'it_admin')
  );

CREATE POLICY "ai_assistance_events_insert"
  ON ai_assistance_events FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor', 'it_admin')
  );

CREATE POLICY "ai_assistance_events_update"
  ON ai_assistance_events FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor', 'department_head')
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    get_user_role(auth.uid()) IN ('assistant', 'doctor', 'department_head')
  );

-- =============================================================================
-- DOMAIN FUNCTIONS & RPCS
-- =============================================================================

-- Atomic query creation helper RPC
CREATE OR REPLACE FUNCTION create_clinical_inquiry(
  p_follow_up_id UUID,
  p_title TEXT,
  p_initial_message TEXT,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role user_role;
  v_query_id UUID;
  v_assigned_to UUID := NULL;
  v_follow_up RECORD;
  v_doctor_profile RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_role := get_user_role(v_user_id);
  IF v_role NOT IN ('coordinator', 'assistant', 'doctor', 'department_head') THEN
    RAISE EXCEPTION 'User role % is not permitted to raise clinical inquiries', v_role;
  END IF;

  SELECT * INTO v_follow_up FROM follow_ups WHERE id = p_follow_up_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up record % not found', p_follow_up_id;
  END IF;

  -- Chain routing:
  -- If Coordinator creates query -> assign to responsible_assistant
  -- If no assistant -> assign to doctor
  -- If Assistant creates query -> assign to doctor
  IF v_role = 'coordinator' THEN
    IF v_follow_up.responsible_assistant_id IS NOT NULL THEN
      v_assigned_to := v_follow_up.responsible_assistant_id;
    ELSE
      SELECT profile_id INTO v_assigned_to FROM doctor_profiles WHERE id = v_follow_up.doctor_id;
    END IF;
  ELSIF v_role = 'assistant' THEN
    SELECT profile_id INTO v_assigned_to FROM doctor_profiles WHERE id = v_follow_up.doctor_id;
  END IF;

  -- Insert query
  INSERT INTO internal_queries (
    follow_up_id,
    title,
    status,
    priority,
    created_by,
    assigned_to
  ) VALUES (
    p_follow_up_id,
    TRIM(p_title),
    'open',
    p_priority,
    v_user_id,
    v_assigned_to
  ) RETURNING id INTO v_query_id;

  -- Insert initial message
  INSERT INTO query_messages (
    query_id,
    sender_id,
    recipient_id,
    body
  ) VALUES (
    v_query_id,
    v_user_id,
    v_assigned_to,
    TRIM(p_initial_message)
  );

  -- Notify recipient if assigned
  IF v_assigned_to IS NOT NULL THEN
    INSERT INTO notifications (
      recipient_id,
      title,
      message,
      category,
      target_type,
      target_id,
      action_url
    ) VALUES (
      v_assigned_to,
      'New Clinical Inquiry: ' || SUBSTRING(p_title FROM 1 FOR 40),
      'A new inquiry was opened regarding follow-up appointment.',
      'inquiry',
      'internal_queries',
      v_query_id::text,
      '/inquiries/' || v_query_id::text
    );
  END IF;

  -- Append audit event
  INSERT INTO audit_events (
    actor_id,
    actor_role,
    action,
    target_type,
    target_id,
    outcome,
    metadata
  ) VALUES (
    v_user_id,
    v_role,
    'clinical_inquiry.created',
    'internal_queries',
    v_query_id::text,
    'success',
    jsonb_build_object(
      'follow_up_id', p_follow_up_id,
      'title', p_title,
      'priority', p_priority,
      'assigned_to', v_assigned_to
    )
  );

  RETURN v_query_id;
END;
$$;

-- Message posting with optional escalation to doctor
CREATE OR REPLACE FUNCTION post_query_reply(
  p_query_id UUID,
  p_body TEXT,
  p_escalate_to_doctor BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role user_role;
  v_query RECORD;
  v_follow_up RECORD;
  v_message_id UUID;
  v_recipient_id UUID;
  v_escalated_to UUID := NULL;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_role := get_user_role(v_user_id);

  SELECT * INTO v_query FROM internal_queries WHERE id = p_query_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query % not found', p_query_id;
  END IF;

  SELECT * INTO v_follow_up FROM follow_ups WHERE id = v_query.follow_up_id;

  -- Handle escalation (Assistant escalating Coordinator's query to Doctor)
  IF p_escalate_to_doctor THEN
    IF v_role NOT IN ('assistant', 'department_head') THEN
      RAISE EXCEPTION 'Only assistants or department heads can escalate inquiries to doctors';
    END IF;

    SELECT profile_id INTO v_escalated_to FROM doctor_profiles WHERE id = v_follow_up.doctor_id;
    v_recipient_id := v_escalated_to;

    -- Update query assignment and status
    UPDATE internal_queries
    SET assigned_to = v_escalated_to,
        status = 'in_progress',
        updated_at = NOW()
    WHERE id = p_query_id;
  ELSE
    -- Normal reply: if sender is creator, recipient is assigned_to; if sender is assigned_to, recipient is creator
    IF v_user_id = v_query.created_by THEN
      v_recipient_id := v_query.assigned_to;
    ELSE
      v_recipient_id := v_query.created_by;
      -- If the assigned person replies, mark answered
      IF v_query.status = 'open' THEN
        UPDATE internal_queries SET status = 'answered', updated_at = NOW() WHERE id = p_query_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO query_messages (
    query_id,
    sender_id,
    recipient_id,
    body,
    is_escalation,
    escalated_to
  ) VALUES (
    p_query_id,
    v_user_id,
    v_recipient_id,
    TRIM(p_body),
    p_escalate_to_doctor,
    v_escalated_to
  ) RETURNING id INTO v_message_id;

  -- Create notification for recipient
  IF v_recipient_id IS NOT NULL AND v_recipient_id <> v_user_id THEN
    INSERT INTO notifications (
      recipient_id,
      title,
      message,
      category,
      target_type,
      target_id,
      action_url
    ) VALUES (
      v_recipient_id,
      'New Reply on Inquiry: ' || SUBSTRING(v_query.title FROM 1 FOR 35),
      'A response was posted in your inquiry thread.',
      'inquiry',
      'internal_queries',
      p_query_id::text,
      '/inquiries/' || p_query_id::text
    );
  END IF;

  -- Audit log
  INSERT INTO audit_events (
    actor_id,
    actor_role,
    action,
    target_type,
    target_id,
    outcome,
    metadata
  ) VALUES (
    v_user_id,
    v_role,
    CASE WHEN p_escalate_to_doctor THEN 'clinical_inquiry.escalated' ELSE 'clinical_inquiry.replied' END,
    'internal_queries',
    p_query_id::text,
    'success',
    jsonb_build_object(
      'message_id', v_message_id,
      'is_escalation', p_escalate_to_doctor,
      'escalated_to', v_escalated_to,
      'recipient_id', v_recipient_id
    )
  );

  RETURN v_message_id;
END;
$$;
