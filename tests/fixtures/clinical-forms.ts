/**
 * Clinical Form Fixtures and Mock Scan Data.
 * Adheres to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §5.2, §5.3, §8.6.
 */

export interface FollowUpPayload {
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string; // YYYY-MM-DD
  severity: 'routine' | 'moderate' | 'high' | 'critical';
  followUpRequired: boolean;
  notes: string;
  visitType: 'post_discharge' | 'routine_check' | 'urgent_review';
}

export const CLINICAL_FORM_FIXTURES: Record<string, FollowUpPayload> = {
  // Standard post-discharge cardiology follow-up (Routine, 14 days out)
  cardioRoutine: {
    patientId: 'pat-synth-001',
    doctorId: 'usr-doctor-0004',
    departmentId: 'dept-cardio-001',
    appointmentDate: '2026-11-14',
    severity: 'routine',
    followUpRequired: true,
    notes: 'Post-CABG follow-up. Check surgical wound healing and review ECG. Maintain prescribed antiplatelets.',
    visitType: 'post_discharge',
  },

  // High-risk cardiology follow-up (Critical, 3 days out)
  cardioCritical: {
    patientId: 'pat-synth-001',
    doctorId: 'usr-doctor-0004',
    departmentId: 'dept-cardio-001',
    appointmentDate: '2026-11-03',
    severity: 'critical',
    followUpRequired: true,
    notes: 'Severe arrhythmia post-stenting. Daily telemetry review and urgent cardiology check.',
    visitType: 'urgent_review',
  },

  // Discharge with no follow-up required (should NOT schedule any reminders)
  dischargeNoFollowUp: {
    patientId: 'pat-synth-003',
    doctorId: 'usr-doctor-0004',
    departmentId: 'dept-cardio-001',
    appointmentDate: '',
    severity: 'routine',
    followUpRequired: false,
    notes: 'Patient recovered fully. No hospital follow-up indicated. Recommended local GP checkup if needed.',
    visitType: 'post_discharge',
  },

  // Proposed correction for Cardio Routine (reschedule to earlier date + moderate severity)
  cardioRoutineCorrection: {
    patientId: 'pat-synth-001',
    doctorId: 'usr-doctor-0004',
    departmentId: 'dept-cardio-001',
    appointmentDate: '2026-11-07',
    severity: 'moderate',
    followUpRequired: true,
    notes: 'Post-CABG follow-up adjusted to Day 7 due to elevated blood pressure observed on discharge.',
    visitType: 'post_discharge',
  },
};

/**
 * Generates synthetic file buffers for scan upload tests, including exact magic byte headers.
 */
export const MOCK_SCAN_FILES = {
  // Valid PDF file buffer with standard %PDF-1.4 magic bytes (0x25, 0x50, 0x44, 0x46)
  validPdf: {
    filename: 'synthetic-doctor-discharge-sheet.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.concat([
      Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
      Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
      Buffer.from('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n'),
      Buffer.from('xref\n0 4\n0000000000 65535 f \n0000000018 00000 n \n'),
      Buffer.from('trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF'),
    ]),
  },

  // Valid PNG file buffer with PNG magic bytes (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  validPng: {
    filename: 'synthetic-discharge-scan.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // Magic bytes
      Buffer.from([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]), // IHDR chunk
      Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00]),
      Buffer.from([0x1F, 0x15, 0xC4, 0x89]), // CRC
      Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]), // IEND
    ]),
  },

  // Adversarial file: Windows Executable renamed as .pdf (Magic bytes MZ = 0x4D, 0x5A)
  maliciousExeAsPdf: {
    filename: 'trojan-scan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.concat([
      Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), // DOS MZ executable header
      Buffer.from('This program cannot be run in DOS mode.'),
    ]),
  },

  // Zero-byte empty file
  emptyFile: {
    filename: 'zero-byte.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(0),
  },
};
