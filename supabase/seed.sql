-- =============================================================================
-- Seed: Core Clinical Departments & Initial Metadata
-- =============================================================================

INSERT INTO departments (name, code, description) VALUES
  ('Cardiology', 'CARD', 'Heart and cardiovascular care'),
  ('Oncology', 'ONCO', 'Comprehensive cancer care and follow-up'),
  ('Neurology', 'NEUR', 'Brain and nervous system disorders'),
  ('Orthopedics', 'ORTH', 'Musculoskeletal system surgery and rehabilitation'),
  ('General Medicine', 'GENM', 'Primary and internal medicine follow-up')
ON CONFLICT (code) DO NOTHING;
