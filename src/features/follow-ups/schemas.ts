import { z } from 'zod';

export const followUpSeverityEnum = z.enum([
  'routine',
  'moderate',
  'high',
  'critical',
]);

export type FollowUpSeverity = z.infer<typeof followUpSeverityEnum>;

export const followUpStatusEnum = z.enum([
  'draft',
  'submitted',
  'active',
  'overdue',
  'completed',
  'cancelled',
]);

export type FollowUpStatus = z.infer<typeof followUpStatusEnum>;

export const clinicalIntakeSchema = z.object({
  patientId: z.string().uuid('Invalid patient identifier'),
  doctorId: z.string().uuid('Invalid doctor identifier'),
  departmentId: z.string().uuid('Invalid department identifier'),
  consultationId: z.string().uuid().optional().nullable(),
  appointmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Appointment date must be formatted as YYYY-MM-DD'),
  followUpRequired: z.boolean().default(true),
  severity: followUpSeverityEnum.default('routine'),
  notes: z.string().max(2000, 'Clinical notes cannot exceed 2000 characters').optional().nullable(),
  sourceDocumentId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => {
    if (data.followUpRequired) {
      if (!data.appointmentDate) return false;
      const appt = new Date(data.appointmentDate);
      return !isNaN(appt.getTime());
    }
    return true;
  },
  {
    message: 'Appointment date is mandatory when follow-up is required',
    path: ['appointmentDate'],
  }
);

export type ClinicalIntakeInput = z.infer<typeof clinicalIntakeSchema>;

export const doctorReviewSchema = z.object({
  followUpId: z.string().uuid('Invalid follow-up identifier'),
  doctorConfirmation: z.literal(true, {
    errorMap: () => ({ message: 'Doctor confirmation of clinical accuracy is required' }),
  }),
  clinicalNotes: z.string().max(2000).optional().nullable(),
  appointmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Appointment date must be formatted as YYYY-MM-DD')
    .optional(),
  severity: followUpSeverityEnum.optional(),
});

export type DoctorReviewInput = z.infer<typeof doctorReviewSchema>;

export interface FollowUpSummary {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientDob: string;
  doctorId: string;
  doctorName?: string;
  departmentId: string;
  departmentName?: string;
  appointmentDate: string;
  severity: FollowUpSeverity;
  status: FollowUpStatus;
  currentVersion: number;
  followUpRequired: boolean;
  notes?: string | null;
  responsibleAssistantId?: string | null;
  sourceDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceDocumentRecord {
  id: string;
  followUpId: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  uploadedBy: string | null;
  createdAt: string;
}
