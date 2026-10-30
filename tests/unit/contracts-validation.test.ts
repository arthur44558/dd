/**
 * Unit Test Suite: Interface Contracts and Schema Validation.
 * Adheres to PROJECT.md § Interface Contracts and HOSPITAL_FOLLOWUP_BUILD_SPEC.md.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Zod schemas defining the authoritative domain contracts from PROJECT.md
const UserRoleSchema = z.enum([
  'reception',
  'assistant',
  'doctor',
  'department_head',
  'coordinator',
  'follow_up_head',
  'it_admin',
]);

const AccountStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'invited',
  'active',
  'deactivated',
]);

const AccessRequestPayloadSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid international phone number'),
  requestedRole: UserRoleSchema,
  departmentId: z.string().optional().nullable(),
  justification: z.string().min(10, 'Justification must be at least 10 characters'),
});

const FollowUpSeveritySchema = z.enum(['routine', 'moderate', 'high', 'critical']);
const FollowUpStatusSchema = z.enum(['draft', 'submitted', 'active', 'overdue', 'completed', 'cancelled']);

const FollowUpRecordSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  departmentId: z.string().min(1),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  severity: FollowUpSeveritySchema,
  status: FollowUpStatusSchema,
  currentVersion: z.number().int().positive(),
  notes: z.string().optional(),
});

const CorrectionProposalPayloadSchema = z.object({
  followUpId: z.string().min(1),
  baseVersion: z.number().int().positive(),
  reason: z.string().min(5, 'Reason must explain the correction'),
  proposedChanges: z.object({
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    severity: FollowUpSeveritySchema.optional(),
    notes: z.string().optional(),
  }),
});

const ApprovalDecisionPayloadSchema = z.object({
  correctionRequestId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
}).refine(
  (data) => data.decision !== 'rejected' || (data.rejectionReason && data.rejectionReason.length >= 5),
  { message: 'Rejection reason is mandatory when rejecting a proposal', path: ['rejectionReason'] }
);

describe('Domain Interface Contracts & Zod Validation', () => {
  describe('AccessRequestPayload Contract', () => {
    it('validates a correct access request payload', () => {
      const validPayload = {
        fullName: 'Dr. Sarah Jenkins',
        email: 'sarah.jenkins@hospital.test',
        phone: '+919876543210',
        requestedRole: 'doctor',
        departmentId: 'dept-cardio-001',
        justification: 'Cardiologist joining OPD follow-up consultations.',
      };

      const result = AccessRequestPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid email format', () => {
      const invalidPayload = {
        fullName: 'Jane Doe',
        email: 'not-an-email',
        phone: '+919876543210',
        requestedRole: 'reception',
        justification: 'Need access for registration.',
      };

      const result = AccessRequestPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('email');
      }
    });

    it('validates account status transitions with AccountStatusSchema', () => {
      expect(AccountStatusSchema.safeParse('active').success).toBe(true);
      expect(AccountStatusSchema.safeParse('deactivated').success).toBe(true);
      expect(AccountStatusSchema.safeParse('invalid_status').success).toBe(false);
    });

    it('rejects an unlisted role type', () => {
      const invalidPayload = {
        fullName: 'Super User',
        email: 'super@hospital.test',
        phone: '+919876543210',
        requestedRole: 'super_admin_unauthorized',
        justification: 'Requesting elevated access.',
      };

      const result = AccessRequestPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('rejects too short justification', () => {
      const invalidPayload = {
        fullName: 'John Doe',
        email: 'john@hospital.test',
        phone: '+919876543210',
        requestedRole: 'assistant',
        justification: 'work', // < 10 chars
      };

      const result = AccessRequestPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('FollowUpRecord Contract', () => {
    it('validates a well-formed follow-up record', () => {
      const record = {
        id: 'fu-001',
        patientId: 'pat-001',
        doctorId: 'doc-001',
        departmentId: 'dept-001',
        appointmentDate: '2026-11-20',
        severity: 'routine',
        status: 'active',
        currentVersion: 1,
        notes: 'Routine 2-week checkup post discharge.',
      };

      const result = FollowUpRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('rejects non-positive version numbers', () => {
      const invalidRecord = {
        id: 'fu-001',
        patientId: 'pat-001',
        doctorId: 'doc-001',
        departmentId: 'dept-001',
        appointmentDate: '2026-11-20',
        severity: 'routine',
        status: 'active',
        currentVersion: 0, // Must be positive int
      };

      const result = FollowUpRecordSchema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('rejects non-standard date format', () => {
      const invalidRecord = {
        id: 'fu-001',
        patientId: 'pat-001',
        doctorId: 'doc-001',
        departmentId: 'dept-001',
        appointmentDate: '20/11/2026', // invalid, must be YYYY-MM-DD
        severity: 'routine',
        status: 'active',
        currentVersion: 1,
      };

      const result = FollowUpRecordSchema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });
  });

  describe('CorrectionProposal & Approval Contracts', () => {
    it('validates a valid correction proposal with changed fields', () => {
      const proposal = {
        followUpId: 'fu-001',
        baseVersion: 1,
        reason: 'Adjusting date following patient availability check.',
        proposedChanges: {
          appointmentDate: '2026-11-25',
          severity: 'moderate',
        },
      };

      const result = CorrectionProposalPayloadSchema.safeParse(proposal);
      expect(result.success).toBe(true);
    });

    it('validates approval decision without rejection reason', () => {
      const decision = {
        correctionRequestId: 'cr-001',
        decision: 'approved',
      };

      const result = ApprovalDecisionPayloadSchema.safeParse(decision);
      expect(result.success).toBe(true);
    });

    it('enforces mandatory rejection reason when decision is rejected', () => {
      const invalidRejection = {
        correctionRequestId: 'cr-001',
        decision: 'rejected',
        // Missing rejectionReason
      };

      const result = ApprovalDecisionPayloadSchema.safeParse(invalidRejection);
      expect(result.success).toBe(false);
    });

    it('accepts rejection decision when valid rejection reason is provided', () => {
      const validRejection = {
        correctionRequestId: 'cr-001',
        decision: 'rejected',
        rejectionReason: 'Clinical review shows 14-day window is mandatory for this protocol.',
      };

      const result = ApprovalDecisionPayloadSchema.safeParse(validRejection);
      expect(result.success).toBe(true);
    });
  });
});
