import { z } from 'zod';

export const correctionRequestItemSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required'),
  originalValue: z.string().nullable().optional(),
  proposedValue: z.string().min(1, 'Proposed value is required'),
});

export const createCorrectionRequestSchema = z.object({
  followUpId: z.string().uuid('Invalid follow-up ID'),
  baseVersion: z.number().int().positive('Base version must be positive'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  supportingEvidence: z.string().optional().nullable(),
  items: z
    .array(correctionRequestItemSchema)
    .min(1, 'At least one field change must be proposed'),
});

export type CreateCorrectionRequestInput = z.infer<typeof createCorrectionRequestSchema>;

export const approveCorrectionRequestSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  decisionReason: z.string().optional().default('Approved by Department Head'),
});

export type ApproveCorrectionRequestInput = z.infer<typeof approveCorrectionRequestSchema>;

export const rejectCorrectionRequestSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  rejectionReason: z
    .string()
    .min(5, 'Rejection reason is mandatory and must be at least 5 characters'),
});

export type RejectCorrectionRequestInput = z.infer<typeof rejectCorrectionRequestSchema>;
