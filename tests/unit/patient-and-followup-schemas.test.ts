/**
 * Unit Test Suite: Patient Registration & Clinical Follow-Up Schemas.
 * Covers validation rules, phone format, DOB checks, shared contact flags, and doctor sign-off.
 */

import { describe, it, expect } from 'vitest';
import {
  patientRegistrationSchema,
  patientSearchSchema,
} from '../../src/features/patients/schemas';
import {
  clinicalIntakeSchema,
  doctorReviewSchema,
} from '../../src/features/follow-ups/schemas';

describe('Patient & Clinical Intake Schemas', () => {
  describe('patientRegistrationSchema', () => {
    it('accepts a valid patient registration input', () => {
      const input = {
        fullName: 'Aarav Sharma',
        dob: '1988-06-15',
        gender: 'male' as const,
        primaryPhone: '9876543210',
        address: 'Flat 402, Lotus Apartments, Bengaluru',
        isSharedContact: false,
        alternateContacts: [
          {
            contactType: 'relative' as const,
            contactValue: '9876501234',
            isSharedContact: true,
            notes: 'Spouse',
          },
        ],
      };

      const result = patientRegistrationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects a future date of birth', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);
      const yyyy = futureDate.getFullYear();
      const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
      const dd = String(futureDate.getDate()).padStart(2, '0');

      const input = {
        fullName: 'Baby Doe',
        dob: `${yyyy}-${mm}-${dd}`,
        gender: 'female' as const,
        primaryPhone: '9876543210',
      };

      const result = patientRegistrationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('dob');
      }
    });

    it('rejects an invalid phone number with letters', () => {
      const input = {
        fullName: 'Jane Doe',
        dob: '1995-01-01',
        gender: 'female' as const,
        primaryPhone: '98765-ABCDE',
      };

      const result = patientRegistrationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('primaryPhone');
      }
    });

    it('rejects names with special characters or numbers', () => {
      const input = {
        fullName: 'User123 #!',
        dob: '1990-05-05',
        gender: 'other' as const,
        primaryPhone: '9876543210',
      };

      const result = patientRegistrationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('fullName');
      }
    });
  });

  describe('patientSearchSchema', () => {
    it('accepts search queries by MRN or phone', () => {
      const res1 = patientSearchSchema.safeParse({ query: 'MRN-2026-100001' });
      expect(res1.success).toBe(true);

      const res2 = patientSearchSchema.safeParse({ phone: '9876543210' });
      expect(res2.success).toBe(true);

      const res3 = patientSearchSchema.safeParse({});
      expect(res3.success).toBe(true);
    });
  });

  describe('clinicalIntakeSchema', () => {
    it('validates a complete clinical intake with required follow-up', () => {
      const intake = {
        patientId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        doctorId: 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
        departmentId: 'c3d4e5f6-a1b2-4c3d-ae4f-5a6b7c8d9e0f',
        appointmentDate: '2026-11-20',
        followUpRequired: true,
        severity: 'high' as const,
        notes: 'Strict medication adherence and blood test follow-up in 2 weeks.',
      };

      const result = clinicalIntakeSchema.safeParse(intake);
      expect(result.success).toBe(true);
    });

    it('rejects intake when followUpRequired is true but appointmentDate is missing or invalid', () => {
      const intake = {
        patientId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        doctorId: 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
        departmentId: 'c3d4e5f6-a1b2-4c3d-ae4f-5a6b7c8d9e0f',
        appointmentDate: 'invalid-date',
        followUpRequired: true,
        severity: 'routine' as const,
      };

      const result = clinicalIntakeSchema.safeParse(intake);
      expect(result.success).toBe(false);
    });

    it('allows intake when followUpRequired is false and appointment date is provided as placeholder', () => {
      const intake = {
        patientId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        doctorId: 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
        departmentId: 'c3d4e5f6-a1b2-4c3d-ae4f-5a6b7c8d9e0f',
        appointmentDate: '2026-12-31',
        followUpRequired: false,
        severity: 'routine' as const,
        notes: 'Discharged in stable condition. No further follow-up necessary.',
      };

      const result = clinicalIntakeSchema.safeParse(intake);
      expect(result.success).toBe(true);
    });
  });

  describe('doctorReviewSchema', () => {
    it('accepts valid review with mandatory doctorConfirmation: true', () => {
      const review = {
        followUpId: 'd4e5f6a1-b2c3-4d4e-bf5a-6b7c8d9e0f1a',
        doctorConfirmation: true as const,
        clinicalNotes: 'Confirmed clinical findings. Plan approved.',
        appointmentDate: '2026-11-22',
        severity: 'moderate' as const,
      };

      const result = doctorReviewSchema.safeParse(review);
      expect(result.success).toBe(true);
    });

    it('rejects review when doctorConfirmation is false or missing', () => {
      const review = {
        followUpId: 'd4e5f6a1-b2c3-4d4e-bf5a-6b7c8d9e0f1a',
        doctorConfirmation: false,
      };

      const result = doctorReviewSchema.safeParse(review);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('doctorConfirmation');
      }
    });
  });
});
