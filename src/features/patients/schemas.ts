import { z } from 'zod';

export const contactTypeEnum = z.enum([
  'primary_phone',
  'secondary_phone',
  'emergency_contact',
  'relative',
  'email',
]);

export type ContactType = z.infer<typeof contactTypeEnum>;

export const patientGenderEnum = z.enum(['male', 'female', 'other', 'unknown']);
export type PatientGender = z.infer<typeof patientGenderEnum>;

export const patientContactSchema = z.object({
  contactType: contactTypeEnum,
  contactValue: z.string().min(3, 'Contact value must be at least 3 characters').max(100),
  isSharedContact: z.boolean().default(false),
  notes: z.string().max(250).optional(),
});

export type PatientContactInput = z.infer<typeof patientContactSchema>;

export const patientRegistrationSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s.'-]+$/, 'Full name contains invalid characters'),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date <= new Date();
    }, 'Date of birth must be a valid past date'),
  gender: patientGenderEnum,
  primaryPhone: z
    .string()
    .min(10, 'Phone number must have at least 10 digits')
    .max(15, 'Phone number must not exceed 15 digits')
    .regex(/^(\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}$/, 'Invalid phone number format'),
  address: z.string().max(500, 'Address must not exceed 500 characters').optional(),
  isSharedContact: z.boolean().default(false),
  alternateContacts: z.array(patientContactSchema).optional().default([]),
});

export type PatientRegistrationInput = z.infer<typeof patientRegistrationSchema>;

export const patientSearchSchema = z.object({
  query: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
});

export type PatientSearchInput = z.infer<typeof patientSearchSchema>;

export interface DedupSearchResult {
  patientId: string;
  mrn: string;
  fullName: string;
  dob: string;
  gender: PatientGender;
  primaryPhone: string;
  matchReasons: string[];
  isSharedContact: boolean;
  sharedCount: number;
}

export interface PatientDetail {
  id: string;
  mrn: string;
  fullName: string;
  dob: string;
  gender: PatientGender;
  primaryPhone: string;
  address: string | null;
  registeredBy: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: Array<{
    id: string;
    contactType: ContactType;
    contactValue: string;
    isVerified: boolean;
    isSharedContact: boolean;
    notes: string | null;
  }>;
}
